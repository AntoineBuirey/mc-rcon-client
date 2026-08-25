let servers = [];
let activeServerId = null;
let commandHistory = [];
let commandHistoryIndex = -1;
let currentDraft = '';
const ws = new WebSocket(`ws://${window.location.host}`);

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const consoleDiv = document.getElementById('console');
    if (data.error) {
        consoleDiv.innerText += `\n[Error] ${data.error}`;
    } else {
        consoleDiv.innerText += `\n> ${data.response}`;
    }
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
};

async function fetchServers() {
    const res = await fetch('/api/servers');

    if (!res.ok) {
        throw new Error('Failed to fetch servers.');
    }

    servers = await res.json();

    const listDiv = document.getElementById('server-list');
    listDiv.innerHTML = '<h3>Servers</h3>';

    servers.forEach(srv => {
        const row = document.createElement('div');
        row.className = 'server-row';

        const btn = document.createElement('button');
        btn.className = 'server-btn';
        btn.innerText = srv.name;
        btn.onclick = () => selectServer(srv.id);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-server-btn';
        deleteBtn.innerText = '×';
        deleteBtn.title = `Delete ${srv.name}`;
        deleteBtn.onclick = (event) => {
            event.stopPropagation();
            deleteServer(srv.id, srv.name);
        };

        row.appendChild(btn);
        row.appendChild(deleteBtn);
        listDiv.appendChild(row);
    });
}

function selectServer(id) {
    activeServerId = id;

    document.querySelectorAll('.server-btn').forEach((button) => {
        const server = servers.find(srv => srv.name === button.innerText);
        button.classList.toggle('active', server?.id === id);
    });

    const srv = servers.find(s => s.id === id);
    if (!srv) return;

    document.getElementById('current-server-title').innerText =
        `${srv.name} (${srv.host}:${srv.port})`;
    document.getElementById('command-input').disabled = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('console').innerText =
        `Connected to ${srv.name} (${srv.host}:${srv.port}).\n`;
}

async function deleteServer(id, name) {
    if (!confirm(`Are you sure you want to delete the server "${name}"? This action cannot be undone.`)) {
        return;
    }

    const res = await fetch(`/api/server/${id}`, {
        method: 'DELETE'
    });

    if (!res.ok) {
        alert('Server deletion failed.');
        return;
    }

    if (activeServerId === id) {
        activeServerId = null;
        document.getElementById('current-server-title').innerText =
            'Select a server';
        document.getElementById('console').innerText =
            'Select a server to view its console output.';
        document.getElementById('command-input').disabled = true;
        document.getElementById('send-btn').disabled = true;
    }

    await fetchServers();
}

const modal = document.getElementById('server-modal');
const serverForm = document.getElementById('server-form');
const formError = document.getElementById('server-form-error');

document.getElementById('add-server-btn').onclick = () => {
    formError.innerText = '';
    serverForm.reset();
    modal.classList.add('visible');
};

document.getElementById('modal-close').onclick = () => {
    modal.classList.remove('visible');
};

modal.onclick = (event) => {
    if (event.target === modal) {
        modal.classList.remove('visible');
    }
};

serverForm.onsubmit = async (event) => {
    event.preventDefault();
    formError.innerText = '';

    const formData = new FormData(serverForm);
    const server = Object.fromEntries(formData.entries());
    server.port = Number(server.port);

    const res = await fetch('/api/server', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(server)
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        formError.innerText = data.error || 'Error while adding server.';
        return;
    }

    modal.classList.remove('visible');
    await fetchServers();
};

function sendCommand() {
    const input = document.getElementById('command-input');
    const command = input.value.trim();
    if (!command || activeServerId === null) return;

    commandHistory.push(command);
    commandHistoryIndex = commandHistory.length;
    currentDraft = '';
    document.getElementById('console').innerText += `\n$ ${command}`;
    ws.send(JSON.stringify({ serverId: activeServerId, command }));
    input.value = '';
}

document.getElementById('command-input').addEventListener('keydown', (e) => {
    const input = e.currentTarget;

    if (e.key === 'Enter') {
        sendCommand();
        return;
    }

    if (e.key === 'ArrowUp') {
        e.preventDefault();

        if (commandHistoryIndex === commandHistory.length) {
            currentDraft = input.value;
        }

        if (commandHistoryIndex > 0) {
            commandHistoryIndex -= 1;
            input.value = commandHistory[commandHistoryIndex];
        }
        return;
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault();

        if (commandHistoryIndex < commandHistory.length - 1) {
            commandHistoryIndex += 1;
            input.value = commandHistory[commandHistoryIndex];
        } else if (commandHistoryIndex === commandHistory.length - 1) {
            commandHistoryIndex = commandHistory.length;
            input.value = currentDraft;
        }
    }
});

fetchServers();