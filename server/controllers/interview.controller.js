import fs from "fs"
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { askAi } from "../services/openRouter.service.js";
import User from "../models/user.model.js";
import Interview from "../models/interview.model.js";

const DIFFICULTY_PLAN = ["easy", "easy", "medium", "medium", "hard"];
const TIME_LIMIT_PLAN = [60, 60, 90, 90, 120];
const TOTAL_QUESTIONS = DIFFICULTY_PLAN.length;

export const analyzeResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume required" });
    }
    const filepath = req.file.path

    const fileBuffer = await fs.promises.readFile(filepath)
    const uint8Array = new Uint8Array(fileBuffer)

    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;

    let resumeText = "";

    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const pageText = content.items.map(item => item.str).join(" ");
      resumeText += pageText + "\n";
    }


    resumeText = resumeText
      .replace(/\s+/g, " ")
      .trim();

    const messages = [
      {
        role: "system",
        content: `
Extract structured data from resume, and form a real understanding of the candidate.

Return strictly JSON:

{
  "role": "string",
  "experience": "string",
  "projects": ["project1", "project2"],
  "skills": ["skill1", "skill2"],
  "candidateProfile": "string"
}

Rules for candidateProfile:
- 3 to 5 sentences, written like an interviewer's private notes before the interview.
- Identify the candidate's strongest area and what's worth probing deeper.
- Call out anything vague, generic, or unverifiable that deserves a follow-up question.
- Do NOT restate the raw fields (role/skills/projects) — add interpretation, not repetition.
`
      },
      {
        role: "user",
        content: resumeText
      }
    ];


    const aiResponse = await askAi(messages)

    const parsed = JSON.parse(aiResponse);

    fs.unlinkSync(filepath)


    res.json({
      role: parsed.role,
      experience: parsed.experience,
      projects: parsed.projects,
      skills: parsed.skills,
      candidateProfile: parsed.candidateProfile,
      resumeText
    });

  } catch (error) {
    console.error(error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({ message: error.message });
  }
};


export const generateQuestion = async (req, res) => {
  try {
    let { role, experience, mode, resumeText, projects, skills, candidateProfile } = req.body

    role = role?.trim();
    experience = experience?.trim();
    mode = mode?.trim();

    if (!role || !experience || !mode) {
      return res.status(400).json({ message: "Role, Experience and Mode are required." })
    }

    const user = await User.findById(req.userId)

    if (!user) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    if (user.credits < 50) {
      return res.status(400).json({
        message: "Not enough credits. Minimum 50 required."
      });
    }

    const projectText = Array.isArray(projects) && projects.length
      ? projects.join(", ")
      : "None";

    const skillsText = Array.isArray(skills) && skills.length
      ? skills.join(", ")
      : "None";

    const safeResume = resumeText?.trim() || "None";
    const safeCandidateProfile = candidateProfile?.trim() || "None";

    const userPrompt = `
    Role:${role}
    Experience:${experience}
    InterviewMode:${mode}
    Projects:${projectText}
    Skills:${skillsText},
    Resume:${safeResume}
    InterviewerNotesOnCandidate:${safeCandidateProfile}
    `;

    if (!userPrompt.trim()) {
      return res.status(400).json({
        message: "Prompt content is empty."
      });
    }

    const messages = [

      {
        role: "system",
        content: `
You are a real human interviewer conducting a professional interview.

Speak in simple, natural English as if you are directly talking to the candidate.

Generate exactly 1 opening interview question, at easy difficulty.

Strict Rules:
- The question must contain between 15 and 25 words.
- The question must be a single complete sentence.
- Do NOT number it.
- Do NOT add explanations.
- Do NOT add extra text before or after.
- Output only the question, nothing else.
- Keep language simple and conversational.
- The question must feel practical and realistic.

Use the interviewer's notes on the candidate to decide what's worth opening with, and base the question on the candidate's role, experience, interviewMode, projects, skills, and resume details.
`
      }
      ,
      {
        role: "user",
        content: userPrompt
      }
    ];


    const aiResponse = await askAi(messages)

    if (!aiResponse || !aiResponse.trim()) {

      return res.status(500).json({
        message: "AI returned empty response."
      });

    }

    const question = aiResponse.trim().split("\n")[0].trim();

    if (!question) {

      return res.status(500).json({
        message: "AI failed to generate a question."
      });
    }

    user.credits -= 50;
    await user.save();

    const interview = await Interview.create({
      userId: user._id,
      role,
      experience,
      mode,
      resumeText: safeResume,
      candidateProfile: safeCandidateProfile,
      totalQuestions: TOTAL_QUESTIONS,
      questions: [{
        question,
        difficulty: DIFFICULTY_PLAN[0],
        timeLimit: TIME_LIMIT_PLAN[0],
      }]
    })

    res.json({
      interviewId: interview._id,
      creditsLeft: user.credits,
      userName: user.name,
      totalQuestions: interview.totalQuestions,
      questions: interview.questions
    });
  } catch (error) {
    return res.status(500).json({message:`failed to create interview ${error}`})
  }
}


export const getNextQuestion = async (req, res) => {
  try {
    const { interviewId } = req.body

    const interview = await Interview.findById(interviewId)

    if (!interview) {
      return res.status(404).json({ message: "Interview not found." });
    }

    const nextIndex = interview.questions.length;

    if (nextIndex >= interview.totalQuestions) {
      return res.status(400).json({ message: "No more questions for this interview." });
    }

    const historyText = interview.questions
      .map((q, i) => `Q${i + 1} (${q.difficulty}): ${q.question}\nCandidate's answer: ${q.answer || "No answer given"}\nScore given: ${q.score ?? "N/A"}/10 — Feedback: ${q.feedback || "N/A"}`)
      .join("\n\n");

    const userPrompt = `
Role: ${interview.role}
Experience: ${interview.experience}
InterviewMode: ${interview.mode}
InterviewerNotesOnCandidate: ${interview.candidateProfile || "None"}

Conversation so far:
${historyText}

Generate question ${nextIndex + 1} of ${interview.totalQuestions}, at ${DIFFICULTY_PLAN[nextIndex]} difficulty.
`;

    const messages = [
      {
        role: "system",
        content: `
You are a real human interviewer conducting a professional interview, continuing a conversation that is already in progress.

Speak in simple, natural English as if you are directly talking to the candidate.

Generate exactly 1 next interview question, reacting to how the candidate has answered so far.

Strict Rules:
- The question must contain between 15 and 25 words.
- The question must be a single complete sentence.
- Do NOT number it.
- Do NOT add explanations.
- Do NOT add extra text before or after.
- Output only the question, nothing else.
- Keep language simple and conversational.
- The question must feel practical and realistic.
- Do NOT repeat or rephrase a question already asked in the conversation so far.
- Match the requested difficulty level for this question.

Adapt using the conversation so far:
- If a previous answer was weak or vague, you may probe deeper on that same topic instead of moving on.
- If a previous answer was strong, move to a new area rather than re-testing it.
- Stay consistent with the interviewer's notes on the candidate.
`
      },
      {
        role: "user",
        content: userPrompt
      }
    ];

    const aiResponse = await askAi(messages)

    if (!aiResponse || !aiResponse.trim()) {
      return res.status(500).json({ message: "AI returned empty response." });
    }

    const question = aiResponse.trim().split("\n")[0].trim();

    if (!question) {
      return res.status(500).json({ message: "AI failed to generate a question." });
    }

    const newQuestion = {
      question,
      difficulty: DIFFICULTY_PLAN[nextIndex],
      timeLimit: TIME_LIMIT_PLAN[nextIndex],
    };

    interview.questions.push(newQuestion);
    await interview.save();

    res.json({
      questionIndex: nextIndex,
      question: interview.questions[nextIndex]
    });
  } catch (error) {
    return res.status(500).json({ message: `failed to generate next question ${error}` })
  }
}


export const submitAnswer = async (req, res) => {
  try {
    const { interviewId, questionIndex, answer, timeTaken } = req.body

    const interview = await Interview.findById(interviewId)
    const question = interview.questions[questionIndex]

    // If no answer
    if (!answer) {
      question.score = 0;
      question.feedback = "You did not submit an answer.";
      question.answer = "";

      await interview.save();

      return res.json({
        feedback: question.feedback
      });
    }

    // If time exceeded
    if (timeTaken > question.timeLimit) {
      question.score = 0;
      question.feedback = "Time limit exceeded. Answer not evaluated.";
      question.answer = answer;

      await interview.save();

      return res.json({
        feedback: question.feedback
      });
    }


    const messages = [
      {
        role: "system",
        content: `
You are a professional human interviewer evaluating a candidate's answer in a real interview.

Evaluate naturally and fairly, like a real person would.

Score the answer in these areas (0 to 10):

1. Confidence – Does the answer sound clear, confident, and well-presented?
2. Communication – Is the language simple, clear, and easy to understand?
3. Correctness – Is the answer accurate, relevant, and complete?

Rules:
- Be realistic and unbiased.
- Do not give random high scores.
- If the answer is weak, score low.
- If the answer is strong and detailed, score high.
- Consider clarity, structure, and relevance.

Calculate:
finalScore = average of confidence, communication, and correctness (rounded to nearest whole number).

Feedback Rules:
- Write natural human feedback.
- 10 to 15 words only.
- Sound like real interview feedback.
- Can suggest improvement if needed.
- Do NOT repeat the question.
- Do NOT explain scoring.
- Keep tone professional and honest.

Return ONLY valid JSON in this format:

{
  "confidence": number,
  "communication": number,
  "correctness": number,
  "finalScore": number,
  "feedback": "short human feedback"
}
`
      }
      ,
      {
        role: "user",
        content: `
Question: ${question.question}
Answer: ${answer}
`
      }
    ];


    const aiResponse = await askAi(messages)


    const parsed = JSON.parse(aiResponse);

    question.answer = answer;
    question.confidence = parsed.confidence;
    question.communication = parsed.communication;
    question.correctness = parsed.correctness;
    question.score = parsed.finalScore;
    question.feedback = parsed.feedback;
    await interview.save();


    return res.status(200).json({feedback :parsed.feedback})
  } catch (error) {
    return res.status(500).json({message:`failed to submit answer ${error}`})

  }
}


export const finishInterview = async (req,res) => {
  try {
    const {interviewId} = req.body
    const interview = await Interview.findById(interviewId)
    if(!interview){
      return res.status(400).json({message:"failed to find Interview"})
    }

    const totalQuestions = interview.questions.length;

    let totalScore = 0;
    let totalConfidence = 0;
    let totalCommunication = 0;
    let totalCorrectness = 0;

    interview.questions.forEach((q) => {
      totalScore += q.score || 0;
      totalConfidence += q.confidence || 0;
      totalCommunication += q.communication || 0;
      totalCorrectness += q.correctness || 0;
    });

    const finalScore = totalQuestions
      ? totalScore / totalQuestions
      : 0;

    const avgConfidence = totalQuestions
      ? totalConfidence / totalQuestions
      : 0;

    const avgCommunication = totalQuestions
      ? totalCommunication / totalQuestions
      : 0;

    const avgCorrectness = totalQuestions
      ? totalCorrectness / totalQuestions
      : 0;

    interview.finalScore = finalScore;
    interview.status = "completed";

    await interview.save();

    return res.status(200).json({
       finalScore: Number(finalScore.toFixed(1)),
      confidence: Number(avgConfidence.toFixed(1)),
      communication: Number(avgCommunication.toFixed(1)),
      correctness: Number(avgCorrectness.toFixed(1)),
      questionWiseScore: interview.questions.map((q) => ({
        question: q.question,
        score: q.score || 0,
        feedback: q.feedback || "",
        confidence: q.confidence || 0,
        communication: q.communication || 0,
        correctness: q.correctness || 0,
      })),
    })
  } catch (error) {
    return res.status(500).json({message:`failed to finish Interview ${error}`})
  }
}


export const getMyInterviews = async (req,res) => {
  try {
    const interviews = await Interview.find({userId:req.userId})
    .sort({ createdAt: -1 })
    .select("role experience mode finalScore status createdAt");

    return res.status(200).json(interviews)

  } catch (error) {
     return res.status(500).json({message:`failed to find currentUser Interview ${error}`})
  }
}

export const getInterviewReport = async (req,res) => {
  try {
    const interview = await Interview.findById(req.params.id)

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }


    const totalQuestions = interview.questions.length;

    let totalConfidence = 0;
    let totalCommunication = 0;
    let totalCorrectness = 0;

    interview.questions.forEach((q) => {
      totalConfidence += q.confidence || 0;
      totalCommunication += q.communication || 0;
      totalCorrectness += q.correctness || 0;
    });
    const avgConfidence = totalQuestions
      ? totalConfidence / totalQuestions
      : 0;

    const avgCommunication = totalQuestions
      ? totalCommunication / totalQuestions
      : 0;

    const avgCorrectness = totalQuestions
      ? totalCorrectness / totalQuestions
      : 0;

       return res.json({
      finalScore: interview.finalScore,
      confidence: Number(avgConfidence.toFixed(1)),
      communication: Number(avgCommunication.toFixed(1)),
      correctness: Number(avgCorrectness.toFixed(1)),
      questionWiseScore: interview.questions
    });

  } catch (error) {
    return res.status(500).json({message:`failed to find currentUser Interview report ${error}`})
  }
}




