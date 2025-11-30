document.addEventListener("DOMContentLoaded", () => {
  const messages = document.querySelectorAll(".flash-message");
  messages.forEach((msg) => {
    setTimeout(() => {
      msg.style.transition = "opacity 0.5s ease, transform 0.5s ease";
      msg.style.opacity = "0";
      msg.style.transform = "translateY(-20px)";
      setTimeout(() => msg.remove(), 500);
    }, 3000);
  });
});