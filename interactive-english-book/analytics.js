// Analytics and Achievements System
import { initializeApp } from "./lib/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment } from "./lib/firebase-firestore.js";
import { firebaseConfig } from "./assets/firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

class AnalyticsSystem {
    constructor() {
        this.sessionStartTime = Date.now();
        this.currentSession = {
            questionsAnswered: 0,
            correctAnswers: 0,
            timeSpent: 0,
            chaptersVisited: new Set(),
            achievements: []
        };
        this.achievements = this.initializeAchievements();
    }

    initializeAchievements() {
        return [
            {
                id: 'first_question',
                title: 'Getting Started',
                description: 'Answer your first question',
                icon: '🎯',
                condition: (stats) => stats.totalQuestions >= 1,
                points: 10
            },
            {
                id: 'perfect_chapter',
                title: 'Perfect Score',
                description: 'Complete a chapter with 100% accuracy',
                icon: '⭐',
                condition: (stats) => stats.perfectChapters >= 1,
                points: 50
            },
            {
                id: 'speed_demon',
                title: 'Speed Demon',
                description: 'Answer 10 questions in under 5 minutes',
                icon: '⚡',
                condition: (stats) => stats.fastAnswers >= 10,
                points: 30
            },
            {
                id: 'streak_master',
                title: 'Streak Master',
                description: 'Maintain a 7-day study streak',
                icon: '🔥',
                condition: (stats) => stats.studyStreak >= 7,
                points: 100
            },
            {
                id: 'knowledge_seeker',
                title: 'Knowledge Seeker',
                description: 'Complete 5 chapters',
                icon: '📚',
                condition: (stats) => stats.completedChapters >= 5,
                points: 75
            },
            {
                id: 'accuracy_expert',
                title: 'Accuracy Expert',
                description: 'Maintain 90% accuracy over 50 questions',
                icon: '🎯',
                condition: (stats) => stats.totalQuestions >= 50 && stats.accuracy >= 90,
                points: 60
            },
            {
                id: 'dedicated_learner',
                title: 'Dedicated Learner',
                description: 'Study for 30 days total',
                icon: '💪',
                condition: (stats) => stats.totalStudyDays >= 30,
                points: 150
            },
            {
                id: 'question_master',
                title: 'Question Master',
                description: 'Answer 100 questions correctly',
                icon: '🏆',
                condition: (stats) => stats.correctAnswers >= 100,
                points: 80
            }
        ];
    }

    // Track question attempt
    trackQuestionAttempt(questionType, isCorrect, timeSpent) {
        this.currentSession.questionsAnswered++;
        if (isCorrect) {
            this.currentSession.correctAnswers++;
        }

        // Track fast answers (under 30 seconds)
        if (timeSpent < 30000 && isCorrect) {
            this.updateUserStats('fastAnswers', 1);
        }

        this.updateUserStats('totalQuestions', 1);
        if (isCorrect) {
            this.updateUserStats('correctAnswers', 1);
        }

        // Track question type statistics
        this.updateQuestionTypeStats(questionType, isCorrect);
    }

    // Track chapter completion
    trackChapterCompletion(chapterId, accuracy) {
        this.currentSession.chaptersVisited.add(chapterId);
        
        if (accuracy === 100) {
            this.updateUserStats('perfectChapters', 1);
        }

        this.updateUserStats('completedChapters', 1);
        this.updateStudyStreak();
    }

    // Track study session
    trackStudySession() {
        const sessionTime = Date.now() - this.sessionStartTime;
        this.currentSession.timeSpent = sessionTime;

        this.updateUserStats('totalStudyTime', sessionTime);
        this.updateUserStats('totalSessions', 1);
        
        // Update daily study tracking
        this.updateDailyStudy();
    }

    // Update study streak
    async updateStudyStreak() {
        try {
            const today = new Date().toDateString();
            const userStatsRef = doc(db, "userStats", this.userId);
            const userStats = await getDoc(userStatsRef);
            
            if (userStats.exists()) {
                const data = userStats.data();
                const lastStudyDate = data.lastStudyDate;
                const currentStreak = data.studyStreak || 0;
                
                if (lastStudyDate !== today) {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    
                    if (lastStudyDate === yesterday.toDateString()) {
                        // Continue streak
                        await updateDoc(userStatsRef, {
                            studyStreak: currentStreak + 1,
                            lastStudyDate: today
                        });
                    } else {
                        // Reset streak
                        await updateDoc(userStatsRef, {
                            studyStreak: 1,
                            lastStudyDate: today
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error updating study streak:', error);
        }
    }

    // Update daily study tracking
    async updateDailyStudy() {
        try {
            const today = new Date().toDateString();
            const userStatsRef = doc(db, "userStats", this.userId);
            
            await updateDoc(userStatsRef, {
                [`dailyStudy.${today}`]: {
                    questionsAnswered: this.currentSession.questionsAnswered,
                    timeSpent: this.currentSession.timeSpent,
                    accuracy: this.currentSession.questionsAnswered > 0 
                        ? (this.currentSession.correctAnswers / this.currentSession.questionsAnswered * 100)
                        : 0
                }
            });
        } catch (error) {
            console.error('Error updating daily study:', error);
        }
    }

    // Update question type statistics
    async updateQuestionTypeStats(questionType, isCorrect) {
        try {
            const userStatsRef = doc(db, "userStats", this.userId);
            const updateData = {};
            
            updateData[`questionTypes.${questionType}.total`] = increment(1);
            if (isCorrect) {
                updateData[`questionTypes.${questionType}.correct`] = increment(1);
            }
            
            await updateDoc(userStatsRef, updateData);
        } catch (error) {
            console.error('Error updating question type stats:', error);
        }
    }

    // Update user statistics
    async updateUserStats(field, value) {
        try {
            if (!this.userId) return;
            
            const userStatsRef = doc(db, "userStats", this.userId);
            await updateDoc(userStatsRef, {
                [field]: increment(value)
            });
        } catch (error) {
            console.error('Error updating user stats:', error);
        }
    }

    // Check and award achievements
    async checkAchievements() {
        try {
            if (!this.userId) return;
            
            const userStatsRef = doc(db, "userStats", this.userId);
            const userStats = await getDoc(userStatsRef);
            
            if (!userStats.exists()) return;
            
            const stats = userStats.data();
            const currentAchievements = stats.achievements || [];
            const newAchievements = [];
            
            for (const achievement of this.achievements) {
                if (!currentAchievements.includes(achievement.id) && achievement.condition(stats)) {
                    newAchievements.push(achievement.id);
                    this.showAchievementNotification(achievement);
                    
                    // Award points
                    await updateDoc(userStatsRef, {
                        score: increment(achievement.points)
                    });
                }
            }
            
            if (newAchievements.length > 0) {
                await updateDoc(userStatsRef, {
                    achievements: [...currentAchievements, ...newAchievements]
                });
            }
            
        } catch (error) {
            console.error('Error checking achievements:', error);
        }
    }

    // Show achievement notification
    showAchievementNotification(achievement) {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-content">
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-text">
                    <div class="achievement-title">Achievement Unlocked!</div>
                    <div class="achievement-name">${achievement.title}</div>
                    <div class="achievement-description">${achievement.description}</div>
                    <div class="achievement-points">+${achievement.points} points</div>
                </div>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(45deg, #fbbf24, #f59e0b);
            color: white;
            padding: 1rem;
            border-radius: 1rem;
            box-shadow: 0 10px 20px rgba(0,0,0,0.3);
            z-index: 1000;
            animation: slideIn 0.5s ease-out;
            max-width: 300px;
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.5s ease-in';
            setTimeout(() => notification.remove(), 500);
        }, 5000);
    }

    // Generate analytics report
    async generateReport(userId) {
        try {
            const userStatsRef = doc(db, "userStats", userId);
            const userStats = await getDoc(userStatsRef);
            
            if (!userStats.exists()) {
                return null;
            }
            
            const stats = userStats.data();
            
            return {
                overview: {
                    totalQuestions: stats.totalQuestions || 0,
                    correctAnswers: stats.correctAnswers || 0,
                    accuracy: stats.totalQuestions > 0 
                        ? Math.round(stats.correctAnswers / stats.totalQuestions * 100)
                        : 0,
                    totalStudyTime: this.formatTime(stats.totalStudyTime || 0),
                    studyStreak: stats.studyStreak || 0,
                    completedChapters: stats.completedChapters || 0
                },
                achievements: {
                    earned: stats.achievements || [],
                    total: this.achievements.length,
                    points: this.achievements
                        .filter(a => (stats.achievements || []).includes(a.id))
                        .reduce((sum, a) => sum + a.points, 0)
                },
                questionTypes: stats.questionTypes || {},
                dailyStudy: stats.dailyStudy || {},
                strengths: this.analyzeStrengths(stats),
                recommendations: this.generateRecommendations(stats)
            };
        } catch (error) {
            console.error('Error generating report:', error);
            return null;
        }
    }

    // Analyze user strengths
    analyzeStrengths(stats) {
        const questionTypes = stats.questionTypes || {};
        const strengths = [];
        
        Object.entries(questionTypes).forEach(([type, data]) => {
            if (data.total > 0) {
                const accuracy = (data.correct / data.total) * 100;
                if (accuracy >= 80) {
                    strengths.push({
                        type: type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        accuracy: Math.round(accuracy)
                    });
                }
            }
        });
        
        return strengths;
    }

    // Generate personalized recommendations
    generateRecommendations(stats) {
        const recommendations = [];
        const questionTypes = stats.questionTypes || {};
        
        // Check for weak areas
        Object.entries(questionTypes).forEach(([type, data]) => {
            if (data.total >= 5) {
                const accuracy = (data.correct / data.total) * 100;
                if (accuracy < 60) {
                    recommendations.push({
                        type: 'improvement',
                        message: `Focus on ${type.replace('-', ' ')} questions - current accuracy: ${Math.round(accuracy)}%`
                    });
                }
            }
        });
        
        // Study streak recommendations
        const streak = stats.studyStreak || 0;
        if (streak === 0) {
            recommendations.push({
                type: 'streak',
                message: 'Start a study streak! Try to study for at least 10 minutes daily.'
            });
        } else if (streak < 7) {
            recommendations.push({
                type: 'streak',
                message: `Great ${streak}-day streak! Keep going to reach the 7-day milestone.`
            });
        }
        
        // Chapter completion recommendations
        const completed = stats.completedChapters || 0;
        if (completed < 3) {
            recommendations.push({
                type: 'progress',
                message: 'Try to complete more chapters to unlock advanced topics.'
            });
        }
        
        return recommendations;
    }

    // Format time in milliseconds to readable format
    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Set user ID for tracking
    setUserId(userId) {
        this.userId = userId;
    }

    // Initialize user stats document
    async initializeUserStats(userId) {
        try {
            const userStatsRef = doc(db, "userStats", userId);
            const userStats = await getDoc(userStatsRef);
            
            if (!userStats.exists()) {
                await setDoc(userStatsRef, {
                    totalQuestions: 0,
                    correctAnswers: 0,
                    totalStudyTime: 0,
                    totalSessions: 0,
                    studyStreak: 0,
                    completedChapters: 0,
                    perfectChapters: 0,
                    fastAnswers: 0,
                    achievements: [],
                    questionTypes: {},
                    dailyStudy: {},
                    createdAt: new Date().toISOString(),
                    lastStudyDate: null
                });
            }
        } catch (error) {
            console.error('Error initializing user stats:', error);
        }
    }
}

// Add CSS for achievement notifications
const achievementStyles = document.createElement('style');
achievementStyles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .achievement-notification {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    .achievement-content {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    
    .achievement-icon {
        font-size: 2rem;
    }
    
    .achievement-title {
        font-weight: bold;
        font-size: 0.9rem;
        margin-bottom: 0.25rem;
    }
    
    .achievement-name {
        font-weight: 600;
        font-size: 1.1rem;
        margin-bottom: 0.25rem;
    }
    
    .achievement-description {
        font-size: 0.9rem;
        opacity: 0.9;
        margin-bottom: 0.25rem;
    }
    
    .achievement-points {
        font-size: 0.8rem;
        font-weight: bold;
    }
`;
document.head.appendChild(achievementStyles);

export default AnalyticsSystem;

