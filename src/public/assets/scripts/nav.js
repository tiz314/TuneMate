let baseNavbar = `<a href="./index.html" class="navbar-brand"><span class="highlight">TuneMate</span></a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarText"
                        aria-controls="navbarText" aria-expanded="false" aria-label="Toggle navigation">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarText">
                        <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                            <li class="nav-item">`



isLoggedIn().then(response => { // if logged in, add loggedIn user links
    if (response.username != undefined) {
        baseNavbar += `<a class="nav-link" href="./songs.html">Songs</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="./pubPlaylists.html">Public playlists</a>
                    </li>
                </ul>
                <ul class='navbar-nav pe-1'>
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            Welcome <b>${response.username}</b>!
                        </a>
                        <ul class="dropdown-menu dropdown-menu-end" id="dropdownMenu">
                            <li><a class="dropdown-item" href="./profile.html">Profile</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item" href="#" onclick="logout()">Logout</a></li>
                        </ul>
                    </li>
                </ul>
            </div>`
        if (location.pathname === "/index.html") document.getElementsByClassName("mainButton")[0].href = "./profile.html"
    }
    else { // else, terminate the base navbar
        baseNavbar += `</li>
                </ul>
                <span class="navbar-text">
                    <a href="./login.html">Login or Signup</a>
                </span>
            </div>`
    }
    document.getElementById("navbar").innerHTML = baseNavbar
})
