const form = document.getElementById('login-form');
const errorEl = document.getElementById('error-message');

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({ username, password }),
            credentials: 'same-origin'
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            errorEl.textContent = data.error || 'Erreur de connexion.';
            return;
        }

        window.location.href = '/';
    } catch (err) {
        errorEl.textContent = 'Impossible de contacter le serveur.';
    }
});