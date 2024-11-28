console.log("Background script running...");

let lastProcessedUrl = "";
let lastTabId = null;
let jobData = {};
const jobPostingUrlPattern = /^https:\/\/www\.linkedin\.com\/voyager\/api\/jobs\/jobPostings\/\d+$/;



chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    try {
        if (request.action === "jobDetails") {

            chrome.storage.local.set({ companyName: request.companyName });
            chrome.storage.local.set({ linkedinCompanyUrl: request.linkedinCompanyUrl });
            sendResponse({ success: true, message: "Job details stored successfully." });
        } else if (request.action === "referralButtonClicked") {
            // console.log("Referral button clicked.");

            // Handle the referral click asynchronously
            handleReferralClick()
                .then((data) => {
                    sendResponse(data); // Send resolved data
                })
                .catch((error) => {
                    sendResponse({ success: false, message: error.message }); // Send error response
                });

            return true; // Keep the message channel open
        }
    } catch (error) {
        console.error("Error processing message:", error.message);
        sendResponse({ success: false, message: error.message });
    }

    // Return true only if processing async actions (to be safe)
    return true;
});


async function handleReferralClick() {

    chrome.cookies.get(
        {
            url: "https://www.jobslist.live", // Replace with your target URL
            name: "jwt"                // Replace with your cookie's name
        },
        (cookie) => {
            if (!cookie) {
                chrome.tabs.create({ url: "https://www.jobslist.live" });
                return {
                    success: false,
                    message: "Login to Jobslist.live first."
                }
            }
        }
    );

    const companyName = await getStorageValue("companyName");
    const linkedinCompanyUrl = await getStorageValue("linkedinCompanyUrl");
    const jobUrl = getJobUrl(jobData);

    // Validate fields for null or invalid values
    if (!jobData.title || !companyName || !linkedinCompanyUrl || !jobUrl) {
        const errorMessage = "Error: Missing required job data. Ensure all fields are populated.";
        console.error(errorMessage, { title: jobData.title, companyName, linkedinCompanyUrl, jobUrl });

        return {
            success: false,
            message: errorMessage
        };
    }

    const job = {
        job_title: jobData.title,
        job_company: companyName,
        job_url_direct: jobUrl,
        job_company_linkedin_url: linkedinCompanyUrl
    };

    // console.log("Sending job data:", job);

    try {
        const response = await fetch("https://api-v3-test.jobslist.live/api/users/referralEmail", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ job }),
            credentials: "include"
        });

        if (!response.ok) throw new Error("Failed to send referral email.");

        const data = await response.json();
        // console.log("Referral data sent successfully:", data);
        chrome.storage.local.set({ referralData: { type: "referralData", content: data } });
        return { success: true, message: "Referral data sent successfully." };
    } catch (error) {
        console.error("Error sending referral email:", error.message);
        return { success: false, message: error.message };
    }
}

chrome.webRequest.onBeforeSendHeaders.addListener(
    async (details) => {
        if (jobPostingUrlPattern.test(details.url)) {

            if (lastProcessedUrl === details.url) return;

            lastProcessedUrl = details.url;

            if (!details.requestHeaders || !Array.isArray(details.requestHeaders)) {
                console.error("Request headers are not available or not an array.");
                return;
            }


            const cookies = details.requestHeaders.find(header => header.name.toLowerCase() === "cookie");
            const csrfToken = details.requestHeaders.find(header => header.name.toLowerCase() === "csrf-token");



            try {
                const response = await fetch(details.url, {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "CSRF-Token": csrfToken?.value || "",
                        "Cookie": cookies ? cookies.value : ""
                    }
                });

                if (!response.ok) throw new Error("Failed to fetch job data.");

                jobData = await response.json();
                // console.log("Job data retrieved:", jobData);

                if (lastTabId) {
                    chrome.tabs.sendMessage(lastTabId, { action: "gotJobData" });
                }
            } catch (error) {
                console.error("Error retrieving job data:", error);
            }
        }
    },
    { urls: ["https://www.linkedin.com/*"] },
    ["requestHeaders"]
);

chrome.tabs.onActivated.addListener((activeInfo) => {
    lastTabId = activeInfo.tabId;
});

function getJobUrl(jobData) {
    const applyMethod = jobData.applyMethod;
    if ("com.linkedin.voyager.jobs.ComplexOnsiteApply" in applyMethod) {
        return jobData.jobPostingUrl?.split("?")[0];
    } else if ("com.linkedin.voyager.jobs.SimpleOnsiteApply" in applyMethod) {
        return jobData.jobPostingUrl?.split("?")[0];
    } else if ("com.linkedin.voyager.jobs.OffsiteApply" in applyMethod) {
        return applyMethod["com.linkedin.voyager.jobs.OffsiteApply"].companyApplyUrl;
    }
    return null;
}

function getStorageValue(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => resolve(result[key]));
    });
}
