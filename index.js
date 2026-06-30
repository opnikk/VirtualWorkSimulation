
    async function login() {

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const response = await fetch("/login", {
    method: "POST",
    headers: {
    "Content-Type": "application/json"
},
    body: JSON.stringify({
    email,
    password
})
});

    const data = await response.json();

    if (data.success) {

    localStorage.setItem("userId", data.userId);
    localStorage.setItem("username", data.username);

    showToast(`Welcome ${data.username}!`);

    setTimeout(() => {
    window.location.href = "dashboard.html";
}, 800);

} else {
    alert(data.error);
}
}

    function showToast(message) {
    const toast = document.getElementById("toast");

    toast.innerText = message;
    toast.classList.add("show");

    setTimeout(() => {
    toast.classList.remove("show");
}, 2500);
}
let isLogin = true;

    function toggleAuth() {
        isLogin = !isLogin;

        const title = document.getElementById("authTitle");
        const username = document.getElementById("authUsername");
        const button = document.getElementById("authButton");
        const toggleText = document.getElementById("toggleText");

        if (isLogin) {
        title.innerText = "Login";
        username.style.display = "none";
        button.innerText = "Login";
        toggleText.innerHTML = `
            Don't have an account?
            <a href="#" onclick="toggleAuth()">Register</a>
        `;
    } else {
        title.innerText = "Register";
        username.style.display = "block";
        button.innerText = "Create account";
        toggleText.innerHTML = `
            Already have an account?
            <a href="#" onclick="toggleAuth()">Login</a>
        `;
    }
    }

    async function authAction() {

    const username = document.getElementById("authUsername").value;
    const email = document.getElementById("authEmail").value;
    const password = document.getElementById("authPassword").value;

    if (isLogin) {

    const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
});

    const data = await res.json();

    if (data.success) {
    localStorage.setItem("userId", data.userId);
    localStorage.setItem("username", data.username);
    showToast(`Welcome ${data.username}`);

    setTimeout(() => {
    window.location.href = "dashboard.html";
}, 800);
} else {
    showToast(data.error);
}

} else {

    const res = await fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password })
});

    const data = await res.json();

    if (data.success) {
    showToast("Account created!");
    toggleAuth(); // takaisin login-näkymään
} else {
    showToast(data.error);
}
}
}