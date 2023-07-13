function showSignupDialog() {
    document.getElementById("loginFormDiv").classList.add("d-none")
    document.getElementById("signupFormDiv").classList.remove("d-none")
    document.getElementById("signupErrorAlert").classList.add("d-none")
}

function showLoginDialog() {
    document.getElementById("loginFormDiv").classList.remove("d-none")
    document.getElementById("signupFormDiv").classList.add("d-none")
    document.getElementById("signupErrorAlert").classList.add("d-none")
}

function signup() { // creating a new account
    const newUser = {
        name: document.getElementById("signupName").value,
        surname: document.getElementById("surname").value,
        date: document.getElementById("date").value,
        genres: chosenGenres,
        artists: chosenArtists,
        email: document.getElementById("email").value,
        username: document.getElementById("username").value,
        password: document.getElementById("signupPassword").value
    }
    fetch(`/user`, { // posting the newly forged object
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
    }).then(response => {
        if (response.ok) {
            const successAlert = document.getElementById("signupSuccessAlert")  // showing success message and reload page (so login form by default)
            successAlert.classList.remove("d-none")
            document.getElementById("signupFormDiv").classList.add("d-none")
            setTimeout(() => location.reload(), 1500)
        } else {
            const errorAlert = document.getElementById("signupErrorAlert") // showing error message
            errorAlert.classList.remove("d-none")
            response.json()
                .then(err => {
                    errorAlert.innerText = err.message
                })
        }
    })
}

function login() {
    const loginAttempt = {
        name: document.getElementById("name").value,
        password: document.getElementById("password").value
    }
    fetch(`/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginAttempt) // posting the login attempt
    }).then(response => {
        if (response.ok) {
            response.json().then(res => {
                location.pathname = "/" // here, if the login process succdeded, the server would send me the token via the response header
            })
        } else {
            const errorAlert = document.getElementById("loginErrorAlert")
            errorAlert.classList.remove("d-none")
            response.json()
                .then(err => {
                    errorAlert.innerText = err.message
                })
        }
    })
}


async function isLoggedIn() { // backend will read cookies from headers and return the username if JWT token is verified
    return await fetch(`/login`).then(response => response.json())
}

function logout() {
    fetch(`/logout`).then(res => {
        if (res.ok) location.replace("/")
    })
}