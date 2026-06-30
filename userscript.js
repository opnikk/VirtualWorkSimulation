const userId = localStorage.getItem("userId");
const username = localStorage.getItem("username");

document.getElementById("welcome").innerText =
    `Welcome ${username}`;

async function loadHistory() {

    const response = await fetch(
        `/history/${userId}`
    );

    const simulations = await response.json();

    console.log(simulations);

    const tbody =
        document.getElementById("historyBody");

    tbody.innerHTML = "";

    simulations.forEach(sim => {

        const row = document.createElement("tr");

        row.innerHTML = `
    <td>${new Date(sim.createdAt).toLocaleDateString()}</td>
    <td>${sim.scenarioType}</td>
    <td>${sim.difficulty}</td>
    <td>${sim.score}</td>
    <td>
        <button onclick="showConversation('${sim._id}', this)">
            Conversation
        </button>
    </td>
    <td>
        <button onclick="showFeedback('${sim._id}', this)">
            Feedback
        </button>
    </td>
`;

        tbody.appendChild(row);
    });
}

loadHistory();

function viewSimulation(id) {
    console.log("Simulation ID:", id);
}

async function showConversation(id, button) {
    const existingRow =
        button.closest("tr").nextElementSibling;

    if (
        existingRow &&
        existingRow.classList.contains("detail-row")
    ) {
        existingRow.remove();
        return;
    }
    document
        .querySelectorAll(".detail-row")
        .forEach(row => row.remove());

    const response = await fetch(`/simulation/${id}`);
    const sim = await response.json();

    const detailRow = document.createElement("tr");
    detailRow.className = "detail-row";

    detailRow.innerHTML = `
        <td colspan="5">
            ${sim.conversation.map(msg => `
                <p>
                    <strong>${msg.role}:</strong>
                    ${msg.text}
                </p>
            `).join("")}
        </td>
    `;

    button.closest("tr").after(detailRow);
}

async function showFeedback(id, button) {
    const existingRow =
        button.closest("tr").nextElementSibling;

    if (
        existingRow &&
        existingRow.classList.contains("detail-row")
    ) {
        existingRow.remove();
        return;
    }
    document
        .querySelectorAll(".detail-row")
        .forEach(row => row.remove());

    const response = await fetch(`/simulation/${id}`);
    const sim = await response.json();

    const detailRow = document.createElement("tr");
    detailRow.className = "detail-row";

    detailRow.innerHTML = `
        <td colspan="5">

            <strong>Score:</strong>
            ${sim.score}

            <br><br>

            ${sim.feedback}

            <br><br>

            <strong>Improvements:</strong>

            <ul>
                ${sim.improvements
        .map(i => `<li>${i}</li>`)
        .join("")}
            </ul>

        </td>
    `;

    button.closest("tr").after(detailRow);
}