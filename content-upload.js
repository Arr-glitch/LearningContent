// Content Upload Script for Firebase
// This script helps administrators add new chapters and questions to the Firebase database

import { initializeApp } from "./lib/firebase-app.js";
import { getFirestore, doc, setDoc, collection, addDoc } from "./lib/firebase-firestore.js";
import { firebaseConfig } from "./assets/firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample content to upload
const sampleChapters = [
    {
        id: "chapter-4",
        title: "Chapter 4: Advanced Grammar",
        lesson: "Master complex grammatical structures including conditional sentences, passive voice, and reported speech.",
        explanation: "Advanced grammar helps you express complex ideas clearly and professionally. These structures are essential for academic and business communication.",
        examples: [
            "Conditional: 'If I had studied harder, I would have passed the exam.'",
            "Passive Voice: 'The book was written by Shakespeare.'",
            "Reported Speech: 'She said that she was coming to the party.'"
        ],
        order: 4,
        difficulty: "advanced",
        estimatedTime: 45,
        questions: [
            {
                type: "multiple-choice",
                question: "Which sentence uses the correct conditional form?",
                options: [
                    "If I will have time, I will call you.",
                    "If I have time, I will call you.",
                    "If I had time, I will call you.",
                    "If I would have time, I call you."
                ],
                correct: 1,
                feedback: "The first conditional uses 'if + present simple, will + infinitive'.",
                difficulty: "intermediate",
                points: 15
            },
            {
                type: "fill-in-blank",
                question: "Convert to passive voice: 'The teacher explains the lesson.' → 'The lesson _____ by the teacher.'",
                correct: ["is explained", "gets explained"],
                feedback: "In passive voice, we use 'be + past participle'. Here it's 'is explained'.",
                difficulty: "intermediate",
                points: 15
            },
            {
                type: "multiple-choice",
                question: "Which are examples of reported speech?",
                options: [
                    "He said, 'I am tired.'",
                    "He said that he was tired.",
                    "He told me he was tired.",
                    "He mentioned being tired."
                ],
                correct: [1, 2, 3],
                feedback: "Reported speech transforms direct quotes into indirect statements.",
                difficulty: "advanced",
                points: 20
            }
        ]
    },
    {
        id: "chapter-5",
        title: "Chapter 5: Business English",
        lesson: "Learn professional communication skills for the workplace including emails, presentations, and meetings.",
        explanation: "Business English requires formal language, clear structure, and professional tone. These skills are crucial for career advancement.",
        examples: [
            "Email opening: 'I hope this email finds you well.'",
            "Making suggestions: 'I would like to propose that we...'",
            "Closing meetings: 'Let's wrap up by summarizing the key points.'"
        ],
        order: 5,
        difficulty: "advanced",
        estimatedTime: 60,
        questions: [
            {
                type: "multiple-choice",
                question: "Which is the most professional email greeting?",
                options: [
                    "Hey there!",
                    "Hi!",
                    "Dear Mr. Smith,",
                    "What's up?"
                ],
                correct: 2,
                feedback: "'Dear Mr. Smith,' is the most formal and professional greeting.",
                difficulty: "beginner",
                points: 10
            },
            {
                type: "drag-drop",
                question: "Arrange these email parts in the correct order:",
                items: ["Closing", "Subject line", "Greeting", "Body", "Signature"],
                correct: ["Subject line", "Greeting", "Body", "Closing", "Signature"],
                feedback: "Professional emails follow a standard structure for clarity.",
                difficulty: "intermediate",
                points: 15
            },
            {
                type: "reading-passage",
                passage: "Dear Ms. Johnson, I am writing to follow up on our meeting last Tuesday regarding the marketing proposal. As discussed, I have attached the revised budget and timeline for your review. I believe these changes address the concerns raised by your team. Please let me know if you need any additional information. I look forward to hearing from you. Best regards, John Smith",
                question: "What is the main purpose of this email?",
                options: [
                    "To schedule a meeting",
                    "To follow up and provide requested information",
                    "To introduce a new proposal",
                    "To apologize for a mistake"
                ],
                correct: 1,
                feedback: "The email follows up on a previous meeting and provides requested revisions.",
                difficulty: "intermediate",
                points: 15
            }
        ]
    }
];

// Function to upload chapters to Firebase
async function uploadChapters() {
    try {
        console.log('Starting chapter upload...');
        
        for (const chapter of sampleChapters) {
            await setDoc(doc(db, "chapters", chapter.id), chapter);
            console.log(`Uploaded chapter: ${chapter.title}`);
        }
        
        console.log('All chapters uploaded successfully!');
        
    } catch (error) {
        console.error('Error uploading chapters:', error);
    }
}

// Function to add a single chapter
async function addChapter(chapterData) {
    try {
        const docRef = await addDoc(collection(db, "chapters"), chapterData);
        console.log("Chapter added with ID: ", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("Error adding chapter: ", error);
        throw error;
    }
}

// Function to update existing chapter
async function updateChapter(chapterId, updates) {
    try {
        await setDoc(doc(db, "chapters", chapterId), updates, { merge: true });
        console.log(`Chapter ${chapterId} updated successfully`);
    } catch (error) {
        console.error("Error updating chapter: ", error);
        throw error;
    }
}

// Example usage functions
window.uploadSampleContent = uploadChapters;
window.addNewChapter = addChapter;
window.updateExistingChapter = updateChapter;

// Content validation function
function validateChapter(chapter) {
    const required = ['title', 'lesson', 'explanation', 'examples', 'questions'];
    const missing = required.filter(field => !chapter[field]);
    
    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    
    // Validate questions
    chapter.questions.forEach((question, index) => {
        if (!question.type || !question.question || !question.correct || !question.feedback) {
            throw new Error(`Question ${index + 1} is missing required fields`);
        }
        
        if (question.type === 'multiple-choice' && !question.options) {
            throw new Error(`Question ${index + 1} is missing options for multiple choice`);
        }
    });
    
    return true;
}

// Batch upload function with validation
async function batchUpload(chapters) {
    try {
        // Validate all chapters first
        chapters.forEach((chapter, index) => {
            try {
                validateChapter(chapter);
            } catch (error) {
                throw new Error(`Chapter ${index + 1}: ${error.message}`);
            }
        });
        
        // Upload all chapters
        for (const chapter of chapters) {
            await setDoc(doc(db, "chapters", chapter.id), chapter);
            console.log(`✓ Uploaded: ${chapter.title}`);
        }
        
        console.log(`Successfully uploaded ${chapters.length} chapters!`);
        
    } catch (error) {
        console.error('Batch upload failed:', error);
        throw error;
    }
}

window.batchUploadChapters = batchUpload;
window.validateChapterData = validateChapter;

console.log('Content upload script loaded. Available functions:');
console.log('- uploadSampleContent(): Upload sample chapters');
console.log('- addNewChapter(data): Add a single chapter');
console.log('- updateExistingChapter(id, updates): Update existing chapter');
console.log('- batchUploadChapters(chapters): Upload multiple chapters with validation');
console.log('- validateChapterData(chapter): Validate chapter structure');

