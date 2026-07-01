const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { OpenAI } = require("openai");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");

dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI);

async function connectDB() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("MongoDB error:", error);
    }
}

connectDB();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const sessions = {}

function getSystemPrompt(level){

    if(level === "easy"){
        return `
You are a polite customer asking about a missing delivery.

Rules:
- Be calm and friendly
- Ask where your order is
- Keep answers short (1-2 sentences)
- Do NOT solve the issue yourself
- The order number agent tells you is correct.

CRITICAL LANGUAGE RULE:
- You must respond ONLY in English.
- Never switch to another language under any circumstance.

Stay in character as a customer.
`
    }

    if(level === "medium"){
        return `
You are a slightly impatient customer wanting to know about a missing delivery.

Rules:
- You are a bit frustrated but still reasonable
- Ask follow-up questions if agent is unclear
- Show mild impatience if service is slow
- Keep responses short (1–2 sentences)

CRITICAL LANGUAGE RULE:
- You must respond ONLY in English.
- Never switch to another language under any circumstance.

Stay in character as a customer.
`
    }

    if(level === "hard"){
        return `
You are an angry customer demanding to know about the whereabouts of a missing delivery.

Rules:
- You are frustrated and impatient
- This is your third time contacting support
- Complain about bad service
- Do NOT calm down easily
- Keep responses short but emotional

CRITICAL LANGUAGE RULE:
- You must respond ONLY in English.
- Never switch to another language under any circumstance.

Stay in character as a customer.
`
    }

    return "You are a customer."
}



app.post("/session", async (req, res) => {
    try {
        const { userId } = req.body;
        const db = client.db("worksimu");

        const history = await db.collection("simulations")
            .find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .toArray();

        const difficulty = chooseDifficulty(history);

        console.log("USER HISTORY LENGTH:", history.length);
        console.log("SELECTED DIFFICULTY:", difficulty);

        const sessionConfig = {
            session: {
                type: "realtime",
                model: "gpt-realtime-1.5",
                //modalities: ["text", "audio"],
                instructions: getSystemPrompt(difficulty),
                audio: {
                    input: {
                        turn_detection: {
                            type: "server_vad",
                            threshold: 0.55,
                            silence_duration_ms: 1000,
                            prefix_padding_ms: 300,
                            create_response: true,
                            interrupt_response: true
                        },
                        transcription: {
                            model: "gpt-realtime-whisper",
                            language: "en",
                        }
                    },
                    output: {
                        voice: "alloy"
                    }
                }
            }
        };

        const response = await fetch(
            "https://api.openai.com/v1/realtime/client_secrets",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(sessionConfig)
            }
        );

        const data = await response.json();

        console.log("SESSION DATA:", data);
        console.log("SELECTED DIFFICULTY:", difficulty);

        res.json({
            ...data,
            difficulty
        });
    } catch (error) {
        console.error("SESSION ERROR:", error);
        res.status(500).json({
            error: error.message
        });
    }
});

function chooseDifficulty(history) {

    if (!history || history.length < 3) {
        return "easy";
    }

    const avg =
        history.reduce((sum, h) => sum + (h.score || 0), 0)
        / history.length;

    const last2 = history.slice(0, 2);
    const last2Avg =
        last2.reduce((sum, h) => sum + (h.score || 0), 0)
        / last2.length;

    // 🔽 huono suoritus → helpompi
    if (avg < 50 || last2Avg < 40) {
        return "easy";
    }

    // 🔼 hyvä suoritus → vaikeampi
    if (avg > 80 && last2Avg > 75) {
        return "hard";
    }

    // välimalli
    return "medium";
}

app.post("/evaluate", async (req, res) => {
    try {
        const { conversation, level } = req.body;

        const evaluationPrompt = `
You are a professional customer service trainer.

Evaluate this customer service interaction.

Scenario difficulty: ${level}

Important:
Your score must reflect BOTH communication quality AND whether the customer's issue was actually handled.
The simulation may be ended by the user at any time.
When evaluating, determine from the conversation whether the customer's issue was actually resolved.
If the conversation ends before the customer's issue is resolved, or before meaningful troubleshooting takes place, significantly reduce the overall score regardless of how polite or professional the agent was.

Assess these categories:

1. Empathy (20)
2. Professionalism (20)
3. Problem-solving (25)
4. Clarity of communication (20)
5. Handling customer emotions (15)

Before assigning a score, determine:

- Did the agent identify the customer's problem?
- Did the agent make meaningful progress toward solving it?
- Was the customer's issue resolved?
- Did the conversation end prematurely?

Scoring rules:

- A conversation that ends before the issue is explored or addressed should receive a LOW score regardless of politeness.
- If the agent only greets the customer or asks one initial question, the total score should usually stay below 30.
- If the conversation ends before meaningful troubleshooting begins, the total score should rarely exceed 40.
- If the customer leaves before the issue is resolved, deduct points for incomplete service.
- Only award scores above 70 when the interaction demonstrates both good communication and meaningful progress toward resolving the customer's issue.
- Scores above 85 require an effective and nearly complete resolution.

General interpretation:
0-10 = almost no useful interaction
10-30 = conversation ended very early
30-60 = partial handling but insufficient
60-75 = acceptable service
75-90 = good service
90-100 = excellent service

Return ONE final integer score from 0 to 100.

Return JSON in this exact format:

{
  "score": number,
  "feedback": "short paragraph",
  "improvements": ["point1", "point2", "point3"]
}

Evaluate carefully internally and return only the JSON.

Conversation:
${JSON.stringify(conversation, null, 2)}
`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert customer service evaluator."
                },
                {
                    role: "user",
                    content: evaluationPrompt
                }
            ],
            response_format: { type: "json_object" }
        });

        res.json(JSON.parse(response.choices[0].message.content));

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: error.message
        });
    }
});

app.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                error: "Missing required fields"
            });
        }

        const db = client.db("worksimu");

        const existingUser = await db.collection("users").findOne({
            email
        });

        if (existingUser) {
            return res.status(400).json({
                error: "Email already in use"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await db.collection("users").insertOne({
            username,
            email,
            passwordHash,
            createdAt: new Date()
        });

        res.json({
            success: true,
            userId: result.insertedId
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: error.message
        });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const db = client.db("worksimu");

        const user = await db.collection("users").findOne({
            email
        });

        if (!user) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        res.json({
            success: true,
            userId: user._id,
            username: user.username
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: error.message
        });
    }
});

app.post("/save-simulation", async (req, res) => {
    try {

        console.log("SAVE REQUEST RECEIVED");
        console.log(req.body);

        const {
            userId,
            scenarioType,
            difficulty,
            conversation,
            score,
            feedback,
            improvements
        } = req.body;

        const db = client.db("worksimu");

        const result = await db.collection("simulations").insertOne({
            userId,
            scenarioType,
            difficulty,
            conversation,
            score,
            feedback,
            improvements,
            createdAt: new Date()
        });

        console.log("SIMULATION SAVED:", result.insertedId);

        res.json({
            success: true,
            simulationId: result.insertedId
        });

    } catch (error) {
        console.error("SAVE ERROR:", error);

        res.status(500).json({
            error: error.message
        });
    }
});

app.get("/history/:userId", async (req, res) => {
    try {

        const db = client.db("worksimu");

        const simulations = await db
            .collection("simulations")
            .find({
                userId: req.params.userId
            })
            .sort({
                createdAt: -1
            })
            .toArray();

        res.json(simulations);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });
    }
});

app.get("/simulation/:id", async (req, res) => {
    try {

        const db = client.db("worksimu");

        const simulation = await db
            .collection("simulations")
            .findOne({
                _id: new ObjectId(req.params.id)
            });

        res.json(simulation);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

