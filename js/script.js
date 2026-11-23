// =========================================
// JSGF Coursework Site - shared script
// =========================================


// =========================================
// Current year in footer
// =========================================

document.querySelectorAll(".js-year").forEach(el => {
    el.textContent = new Date().getFullYear();
});


// =========================================
// Back to top button
// =========================================
// (appears once the user has scrolled down the page)

const backToTop = document.getElementById("back-to-top");

if (backToTop) {
    const toggleBackToTop = () => {
        backToTop.classList.toggle("show", window.scrollY > 400);
    };

    window.addEventListener("scroll", toggleBackToTop, { passive: true });
    toggleBackToTop();

    backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}


// =========================================
// Fullscreen button for the scene viewer
// =========================================

document.querySelectorAll("[data-fullscreen]").forEach(button => {
    button.addEventListener("click", () => {
        const target = document.querySelector(button.dataset.fullscreen);

        if (target && target.requestFullscreen) {
            target.requestFullscreen();
        }
    });
});


// =========================================
// Copy buttons on documentation code blocks
// =========================================

document.querySelectorAll(".code-block").forEach(block => {
    const button = block.querySelector(".copy-btn");
    const code = block.querySelector("pre");

    if (!button || !code || !navigator.clipboard) {
        button?.remove();
        return;
    }

    button.addEventListener("click", () => {
        navigator.clipboard.writeText(code.innerText).then(() => {
            button.textContent = "Copied";
            setTimeout(() => (button.textContent = "Copy"), 1500);
        });
    });
});
