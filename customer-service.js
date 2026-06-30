let score = 0
let scenario = ""
let messageCount = 0
let pc;
let dc;
let scenarioEnded = false;
let scenarioOngoing = false;
let conversationHistory = [];
let scenarioType = "";
let difficulty = "";
let finishingScenario = false;
const MAX_MESSAGES = 15;



async function startScenario(){
    scenarioEnded = false;
    finishingScenario = false;
    conversationHistory = [];
    difficulty = "";
    scenarioType = "lost-package";

    document.querySelector('.difficultyUI').classList.add('hidden');

    document.getElementById("chatBox").innerHTML=""
    addSystemMessage("Connecting to AI...");

    if(scenarioOngoing == false){
    document.getElementById("infoBox").innerHTML=""
    generateCustomerInfo() }


    score = 0
    messageCount = 0
    //updateScore()

    scenario = ""
    scenarioOngoing = true;

    await startVoiceSession();
    document.getElementById("scenarioTitle").innerText =
        "Customer Service Simulation";

}

function generateCustomerInfo() {

    const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const firstNames = ["Jane", "Mary", "Olivia", "Patricia", "Lily", "Jennifer", "Poppy", "Linda", "Ava", "Elizabeth"];
    const lastNames = ["Smith", "Walker", "Doe", "Green", "Jones", "Baker", "Miller", "Davis", "Taylor", "Evans"];
    
    // Status map
    const statusMap = {
        "In Transit": [
            "Package is currently at the local sorting facility.",
            "Awaiting customs clearance."
        ],
        "Delivered": [
            "Left at the front door.",
        ],
        "Processing": [
            "Order confirmed. Preparing for shipment.",
            "Package is being packed at the fulfillment center."
        ],
        "Delayed": [
            "Delayed due to weather conditions.",
            "Delayed due to high holiday volume."
        ],
        "Out for Delivery": [
            "Package is with the local courier for delivery.",
            "Estimated delivery by end of day."
        ]
    };

    const statuses = Object.keys(statusMap);
    const randomStatus = getRandomElement(statuses);

    const validDetails = statusMap[randomStatus];
    const randomDetail = getRandomElement(validDetails);
    
    // Generate data
    const randomFullName = `${getRandomElement(firstNames)} ${getRandomElement(lastNames)}`;
    const randomOrderID = Math.floor(100000 + Math.random() * 900000); 
    
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + Math.floor(Math.random() * 5));
    const formattedDate = deliveryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    let chat = document.getElementById("infoBox");
    if (!chat) return;

    const messageDiv = document.createElement("div");
    messageDiv.className = "message system";
    messageDiv.style.cssText = "margin-bottom: 15px; padding-left: 10px; line-height: 1.5;";

    const lines = [
        { label: "Customer", value: randomFullName },
        { label: "Order ID", value: randomOrderID.toString() },
        { label: "Package status", value: randomStatus },
        { label: "Details", value: randomDetail },
        { label: "Estimated delivery", value: formattedDate }
    ];

    chat.appendChild(messageDiv);

    // Typewriter 
    let lineIndex = 0;
    let charIndex = 0;
    let currentSpan = null;
    const typingSpeed = 15; // Lower = faster (in milliseconds per character)

    function type() {
        if (lineIndex >= lines.length) return;

        const currentLine = lines[lineIndex];

        // If starting a brand new line, create its HTML structure
        if (charIndex === 0) {
            const lineWrapper = document.createElement("div");
            lineWrapper.innerHTML = `<strong>${currentLine.label}:</strong> `;
            
            // Create a span dedicated to holding the typed text safely
            currentSpan = document.createElement("span");
            lineWrapper.appendChild(currentSpan);
            messageDiv.appendChild(lineWrapper);
        }

        currentSpan.textContent += currentLine.value.charAt(charIndex);
        charIndex++;

        chat.scrollTop = chat.scrollHeight;

        if (charIndex < currentLine.value.length) {
            setTimeout(type, typingSpeed);
        } else {
            lineIndex++;
            charIndex = 0; 
            setTimeout(type, typingSpeed * 3);
        }
    }

    type();
}

function addCustomerMessage(text){

    let chat = document.getElementById("chatBox")
    chat.innerHTML += `<div class="message customer">${text}</div>`
    chat.scrollTop = chat.scrollHeight

}

function addUserMessage(text){

    let chat = document.getElementById("chatBox")
    chat.innerHTML += `<div class="message user">${text}</div>`
    chat.scrollTop = chat.scrollHeight

    messageCount++;
    checkMessageLimit();

}

// 🏁 Scenario ending + feedback

function endScenario(result) {
    scenarioOngoing = false;

    document.querySelector('.difficultyUI').classList.remove('hidden');

    document.getElementById("scenarioTitle").innerText =
    " "

    

    let chat = document.getElementById("chatBox");

    chat.insertAdjacentHTML("beforeend", `

<div class="message system evaluation-result">
<strong>Scenario ended.</strong><br><br>
Score: ${result.score}/100<br><br>
${result.feedback}

<br><br>
<strong>Areas to improve:</strong>
<ul>
${result.improvements.map(i => `<li>${i}</li>`).join("")}
</ul>
</div>
`);

    const evaluation = chat.querySelector(".evaluation-result:last-child");

    evaluation.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

async function startVoiceSession() {
    const userId = localStorage.getItem("userId");
    const tokenResponse = await fetch("/session", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },


        body: JSON.stringify({
            userId
        })
    });

    const text = await tokenResponse.text();
    console.log("Session response:", text);

    let data;

    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error("Non-JSON response:", text);
        throw e;
    }

    difficulty = data.difficulty;
    scenario = data.difficulty;

    const EPHEMERAL_KEY = data.value;

    pc = new RTCPeerConnection();

    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    /*
    pc.ontrack = e => {
        audioEl.srcObject = e.streams[0];
    };
    */

    pc.ontrack = async e => {
    const aiStream = e.streams[0];

    audioEl.srcObject = aiStream;

    await connectStream(aiStream);};

    const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
    });

    stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
    });

    

    dc = pc.createDataChannel("oai-events");

    dc.onopen = () => {
        console.log("Data channel open");
        addSystemMessage("Connected. You can now greet the customer.");

        dc.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
                type: "message",
                role: "user",
                content: [
                    {
                        type: "input_text",
                        text: "Start the customer service scenario."
                    }
                ]
            }
        }));
        dc.send(JSON.stringify({
            type: "response.create",
            response: {
                modalities: ["text", "audio"]
            }
        }));
    };

    dc.onmessage = event => {
        const msg = JSON.parse(event.data);
        console.log("FULL EVENT:", msg);
        handleRealtimeMessage(msg);
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
            method: "POST",
            body: offer.sdp,
            headers: {
                Authorization: `Bearer ${EPHEMERAL_KEY}`,
                "Content-Type": "application/sdp",
            }
        }
    );

    const answerSdp = await sdpResponse.text();
    console.log("SDP RESPONSE:", answerSdp);

    if (!sdpResponse.ok) {
        throw new Error(answerSdp);
    }

    const answer = {
        type: "answer",
        sdp: answerSdp
    };

    await pc.setRemoteDescription(answer);
    console.log("Connected!");
}

let currentAITranscript = "";

function handleRealtimeMessage(msg) {
    console.log("Realtime:", msg);

    // käyttäjän puhe
    if (msg.type === "conversation.item.input_audio_transcription.completed") {
        const text = msg.transcript?.trim();

        if (!text || text.length < 2) return;

        addUserMessage(text);

        conversationHistory.push({
            role: "agent",
            text
        });
    }

    // uusi AI response alkaa -> nollaa bufferi
    if (msg.type === "response.created") {
        currentAITranscript = "";
    }

    // transcript stream
    if (msg.type === "response.output_audio_transcript.delta") {
        currentAITranscript += msg.delta || "";
    }

    // valmis vastaus
    if (msg.type === "response.output_audio_transcript.done") {
        const finalText = currentAITranscript.trim() || msg.transcript?.trim();

        if (finalText) {
            addCustomerMessage(finalText);

            conversationHistory.push({
                role: "customer",
                text: finalText
            });
        }

        currentAITranscript = "";
    }
}

async function finishScenario() {
    if (finishingScenario) return;
    finishingScenario = true;

    if (pc) {
        pc.close();
    }

    const evaluation = await evaluateConversation();
    await saveSimulation(evaluation);

    scenarioEnded = true;
    endScenario(evaluation);
}
async function evaluateConversation() {
    const response = await fetch("/evaluate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            conversation: conversationHistory,
            level: scenario
        })
    });

    return await response.json();
}

function addSystemMessage(text) {
    let chat = document.getElementById("chatBox");

    chat.innerHTML += `<div class="message system">${text}</div>`;
    chat.scrollTop = chat.scrollHeight;
}

function addInfo(text) {
    let chat = document.getElementById("infoBox");

    chat.innerHTML += `<div class="message system">${text}</div>`;
    chat.scrollTop = chat.scrollHeight;
}

function checkMessageLimit() {
    if (messageCount >= MAX_MESSAGES && !scenarioEnded) {
        finishScenario();
    }
}

async function saveSimulation(evaluation) {
    console.log("saveSimulation called");

    const userId = localStorage.getItem("userId");

    // vieraskäyttäjä -> ei tallenneta
    if (!userId) {
        console.log("no userId");
        return;
    }

    const response = await fetch("/save-simulation", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            userId,
            scenarioType,
            difficulty,
            conversation: conversationHistory,
            score: evaluation.score,
            feedback: evaluation.feedback,
            improvements: evaluation.improvements
        })
    });

    const data = await response.json();

    console.log("SAVE RESPONSE:", data);
}