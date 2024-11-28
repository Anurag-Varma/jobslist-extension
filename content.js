console.log("Content script running...");

let prevCompanyName = null;
let prevLinkedinCompanyUrl = null;


// Function to inject CSS for the toast
function injectToastStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      .toast {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        background-color: #333;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        opacity: 0;
        animation: fadeIn 0.5s forwards;
        margin-bottom: 10px; /* Add some margin between toasts */
      }
  
      .toast-success {
        background-color: green;
      }
  
      .toast-error {
        background-color: red;
      }
  
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style); // Append the style to the head of the document
}

// Function to show a toast message
function showToast(title, message, type) {
    const toasts = document.querySelectorAll(".toast");

    // If there are existing toasts, move them up a bit
    toasts.forEach((toast, index) => {
        const currentBottom = parseInt(window.getComputedStyle(toast).bottom, 10);
        toast.style.bottom = `${currentBottom + 70}px`; // Move up the existing toast by 70px
    });

    const toast = document.createElement("div");
    toast.classList.add("toast", `toast-${type}`);
    toast.innerHTML = `
      <strong>${title}</strong>
      <p>${message}</p>
    `;

    // Set initial position for the new toast
    toast.style.bottom = '20px'; // Place the new toast at the bottom

    document.body.appendChild(toast);

    // Remove the toast after a few seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}




// Function to send an individual email
async function sendEmail(person) {
    try {
        const response = await fetch("https://api-v3-test.jobslist.live/api/users/send-email", {
            method: "POST",
            headers: {
                'Referer': 'https://www.jobslist.live',
                'Content-Type': 'application/json',
                'Origin': 'https://www.jobslist.live'

            },
            body: JSON.stringify({
                recipient: person.email,
                subject: person.subject,
                body: person.email_content
            }),
            credentials: "include"
        });

        if (!response.ok) throw new Error("Failed to send email.");

        data = await response.json();

        if (data.authUrl) {
            // chrome.tabs.create({ url: data.authUrl });
            chrome.runtime.sendMessage({ action: "createTab", url: data.authUrl });

            showToast("Error", "Connect your gmail to send emails", "error");
        }
        else {
            showToast("Success", `Email sent to ${person.email}`, "success");
        }

    } catch (error) {
        showToast("Error", error.message, "error");
    }
}



// Function to create and display referral modal
function createReferralModal(jobData) {
    // Check if the modal already exists
    if (!document.getElementById("custom-overlay-modal")) {
        // Create the overlay
        const overlay = document.createElement("div");
        overlay.id = "custom-overlay-modal";
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
        overlay.style.zIndex = "10000"; // Ensure it's above all other elements
        overlay.style.display = "flex";
        overlay.style.justifyContent = "center";
        overlay.style.alignItems = "center";

        // Create the modal content
        const modalContent = document.createElement("div");
        modalContent.id = "modal-content";
        modalContent.style.backgroundColor = "white";
        modalContent.style.padding = "30px";
        modalContent.style.borderRadius = "10px";
        modalContent.style.boxShadow = "0 0 15px rgba(0, 0, 0, 0.5)";
        modalContent.style.width = "60%";
        // modalContent.style.height = "30%";

        modalContent.style.maxWidth = "80%";
        modalContent.style.maxHeight = "80%";
        modalContent.style.overflow = "auto";


        // Add modal content dynamically
        const modalHeader = `
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
                        <h2>Referral Emails</h2>
                        <button id="close-modal-btn" style="
                        background: none;
                        color: red;
                        border: none;
                        font-size: 30px;
                        cursor: pointer;
                        ">&times;</button>
                    </div>
                    `;

        const modalBody = jobData.error.length > 0
            ? `<p style="color: red;">Error: ${jobData.error.join(', ')}</p>`
            : jobData.data && jobData.data.length > 0
                ? `
                            <div style="text-align: center; margin-bottom: 15px;">
                            <button id="send-all-btn" style="
                                padding: 10px 20px;
                                margin-top: 15px;
                                background-color: #007BFF;
                                color: white;
                                border: none;
                                border-radius: 5px;
                                font-size: 16px;
                                cursor: pointer;
                            ">Send All Emails</button>
                            </div>
                            <ul style="list-style: none; padding: 0;">
                            ${jobData.data.map((person, index) => `
                                <li key="${index}" style="margin-bottom: 20px; padding: 15px; border: 1px solid #000; border-radius: 5px;">
                                <h5>${person.name}</h5>
                                <p><strong>Email: </strong>${person.email}</p>
                                <p>
                                    <strong>LinkedIn: </strong>
                                    <a href="${person.linkedin_profile_url}" target="_blank" style="color: blue;">
                                    ${person.linkedin_profile_url}
                                    </a>
                                </p>
                                <p><strong>Subject:</strong> ${person.subject}</p>
                                <p><strong>Email Content:</strong></p>
                                <pre>${person.email_content}</pre>
                                <div style="margin-top: 10px;">
                                    <button class="send-email-btn" data-index="${index}" style="
                                    padding: 10px 20px;
                                    background-color: #007BFF;
                                    color: white;
                                    border: none;
                                    border-radius: 5px;
                                    font-size: 16px;
                                    cursor: pointer;
                                    ">Send Email</button>
                                </div>
                                </li>
                            `).join('')}
                            </ul>
                        `
                : `<p>No referral data available for this company</p>`;

        const modalFooter = `
                <div style="text-align: right; border-top: 1px solid #ddd; padding-top: 10px;">
                    <button id="close-footer-btn" style="
                    padding: 10px 20px;
                    background-color: red;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    ">Close</button>
                </div>
                `;

        modalContent.innerHTML = modalHeader + modalBody + modalFooter;

        // Add modal content to overlay
        overlay.appendChild(modalContent);

        // Add overlay to the page
        document.body.appendChild(overlay);

        // Event listeners for buttons
        document.getElementById("close-modal-btn").addEventListener("click", () => overlay.remove());
        document.getElementById("close-footer-btn").addEventListener("click", () => overlay.remove());

        const sendButtons = document.querySelectorAll(".send-email-btn");

        if (document.getElementById("send-all-btn")) {
            document.getElementById("send-all-btn").addEventListener("click", (e) => {
                const button = e.target;
                button.disabled = true; // Disable the button
                button.innerText = "All Emails Sent"; // Update button text
                button.style.backgroundColor = 'grey';  // Change to grey
                button.style.cursor = 'not-allowed';  // Change cursor to indicate it's not clickable
                button.style.color = 'darkgrey';  // Change text color to dark grey


                sendButtons.forEach((button) => {
                    if (!button.disabled) {
                        const index = button.getAttribute("data-index");
                        const person = jobData.data[index];

                        // Disable the button and update its properties
                        button.disabled = true;
                        button.innerText = "Email Sent"; // Update button text
                        button.style.backgroundColor = "grey"; // Change to grey
                        button.style.cursor = "not-allowed"; // Change cursor to indicate it's not clickable
                        button.style.color = "darkgrey"; // Change text color to dark grey
                        sendEmail(person);
                        setTimeout(() => {
                        }, 1000);
                    }

                });

            });
        }


        sendButtons.forEach((button) => {
            button.addEventListener("click", (e) => {
                const index = e.target.getAttribute("data-index");
                const person = jobData.data[index];
                button.disabled = true; // Disable the button
                button.innerText = "Email Sent"; // Update button text
                button.style.backgroundColor = 'grey';  // Change to grey
                button.style.cursor = 'not-allowed';  // Change cursor to indicate it's not clickable
                button.style.color = 'darkgrey';  // Change text color to dark grey
                sendEmail(person);
                setTimeout(() => {
                }, 1000);
            });
        });
    }

}

// Function to add the referral button
function addReferralButton() {
    const existingButton = document.querySelector(".jobs-save-button");
    if (!existingButton) return;

    if (document.querySelector(".ask-referrals-button")) return;

    const referralButton = document.createElement("button");
    referralButton.id = "ask-referrals-button";
    referralButton.textContent = "Referrals";
    referralButton.className = "ask-referrals-button artdeco-button artdeco-button--secondary artdeco-button--3";
    referralButton.style.cssText = `
        margin-left: 10px;
        background-color: green;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
    `;

    referralButton.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "referralButtonClicked" }, (response) => {
            // console.log("Response from background script:", response);
            if (response.success) {
                chrome.storage.local.get(['referralData'], function (result) {
                    // Check if the referralData exists in the result
                    if (result.referralData) {
                        createReferralModal(result.referralData.content);
                    } else {
                        console.log('No referral Data found.');
                    }
                });

                referralButton.disabled = true;
                referralButton.style.backgroundColor = "grey";
                referralButton.style.cursor = "not-allowed";
                referralButton.style.color = "darkgrey";

            } else {
                showToast("Error", response.message, "error");
            }
        });

    });

    existingButton.insertAdjacentElement("afterend", referralButton);
}

// Add referral button when job data is received
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "gotJobData") {
        // console.log("Job data received:", message.jobData);
        addReferralButton();
        sendResponse({ success: true });
    }
    else {
        sendResponse({ success: false, message: "Unknown action." });
    }
    return true;
});

// Monitor LinkedIn job details and extract company name & URL
const observer = new MutationObserver(() => {
    const jobDetailsWrapper = document.querySelector(".jobs-search__job-details--container");
    if (jobDetailsWrapper) {

        const companyName = jobDetailsWrapper.querySelector(".job-details-jobs-unified-top-card__company-name a")?.innerText;
        const linkedinCompanyUrl = jobDetailsWrapper.querySelector("a")?.href.replace("/life", "");

        if (companyName && prevCompanyName !== companyName && linkedinCompanyUrl && prevLinkedinCompanyUrl !== linkedinCompanyUrl) {
            prevCompanyName = companyName;
            prevLinkedinCompanyUrl = linkedinCompanyUrl;
            chrome.runtime.sendMessage({ action: "jobDetails", companyName, linkedinCompanyUrl });
        }

    }
});

observer.observe(document.body, { childList: true, subtree: true });

// Reset job detail logging when a new job is opened
let hasLoggedJobDetails = false;
document.body.addEventListener("click", (event) => {
    const scaffoldLayoutListContainer = document.querySelector(".scaffold-layout__list-container");
    if (scaffoldLayoutListContainer && scaffoldLayoutListContainer.contains(event.target)) {
        hasLoggedJobDetails = false;
    }
});

// Inject styles on load
injectToastStyles();
