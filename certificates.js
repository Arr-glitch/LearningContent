// Certificate Generation System
import { initializeApp } from "./lib/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "./lib/firebase-firestore.js";
import { getAuth } from "./lib/firebase-auth.js";
import { firebaseConfig } from "./assets/firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

class CertificateSystem {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.certificateTemplates = this.initializeTemplates();
    }

    initializeTemplates() {
        return {
            completion: {
                title: "Certificate of Completion",
                subtitle: "English Learning Program",
                description: "has successfully completed the Interactive English Learning Course",
                color: "#3b82f6",
                icon: "🎓"
            },
            excellence: {
                title: "Certificate of Excellence",
                subtitle: "Outstanding Performance",
                description: "has demonstrated exceptional proficiency in English learning with outstanding results",
                color: "#f59e0b",
                icon: "⭐"
            },
            mastery: {
                title: "Certificate of Mastery",
                subtitle: "Advanced English Skills",
                description: "has achieved mastery level in English language skills through dedicated learning",
                color: "#10b981",
                icon: "🏆"
            }
        };
    }

    async generateCertificate(userId, type = 'completion', customData = {}) {
        try {
            // Get user data
            const userDoc = await getDoc(doc(db, "users", userId));
            const userProgressDoc = await getDoc(doc(db, "userProgress", userId));
            const userStatsDoc = await getDoc(doc(db, "userStats", userId));
            
            if (!userDoc.exists() || !userProgressDoc.exists()) {
                throw new Error('User data not found');
            }
            
            const userData = userDoc.data();
            const progressData = userProgressDoc.data();
            const statsData = userStatsDoc.exists() ? userStatsDoc.data() : {};
            
            // Determine certificate type based on performance
            const certificateType = this.determineCertificateType(progressData, statsData, type);
            const template = this.certificateTemplates[certificateType];
            
            // Create certificate data
            const certificateData = {
                id: `cert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                userId: userId,
                type: certificateType,
                recipientName: customData.name || userData.email.split('@')[0],
                issueDate: new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }),
                completionDate: new Date().toISOString(),
                score: progressData.score || 0,
                accuracy: statsData.totalQuestions > 0 
                    ? Math.round((statsData.correctAnswers / statsData.totalQuestions) * 100)
                    : 0,
                chaptersCompleted: progressData.completedChapters?.length || 0,
                studyTime: this.formatTime(statsData.totalStudyTime || 0),
                achievements: statsData.achievements?.length || 0,
                template: template,
                ...customData
            };
            
            // Generate certificate image
            const certificateImage = await this.createCertificateImage(certificateData);
            
            // Save certificate to Firebase
            await setDoc(doc(db, "certificates", certificateData.id), certificateData);
            
            return {
                certificateData,
                imageDataUrl: certificateImage,
                downloadUrl: this.createDownloadUrl(certificateImage, certificateData.id)
            };
            
        } catch (error) {
            console.error('Error generating certificate:', error);
            throw error;
        }
    }

    determineCertificateType(progressData, statsData, requestedType) {
        const accuracy = statsData.totalQuestions > 0 
            ? (statsData.correctAnswers / statsData.totalQuestions) * 100
            : 0;
        const chaptersCompleted = progressData.completedChapters?.length || 0;
        const achievements = statsData.achievements?.length || 0;
        
        // Auto-determine based on performance if not specified
        if (requestedType === 'auto') {
            if (accuracy >= 95 && chaptersCompleted >= 5 && achievements >= 5) {
                return 'mastery';
            } else if (accuracy >= 85 && chaptersCompleted >= 3 && achievements >= 3) {
                return 'excellence';
            } else {
                return 'completion';
            }
        }
        
        return requestedType;
    }

    async createCertificateImage(certificateData) {
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1200;
        this.canvas.height = 800;
        this.ctx = this.canvas.getContext('2d');
        
        const { template, recipientName, issueDate, score, accuracy, chaptersCompleted } = certificateData;
        
        // Background gradient
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.5, '#f8fafc');
        gradient.addColorStop(1, '#e2e8f0');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Border
        this.ctx.strokeStyle = template.color;
        this.ctx.lineWidth = 8;
        this.ctx.strokeRect(40, 40, this.canvas.width - 80, this.canvas.height - 80);
        
        // Inner border
        this.ctx.strokeStyle = template.color;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(60, 60, this.canvas.width - 120, this.canvas.height - 120);
        
        // Header decoration
        this.ctx.fillStyle = template.color;
        this.ctx.fillRect(100, 100, this.canvas.width - 200, 4);
        
        // Title
        this.ctx.fillStyle = template.color;
        this.ctx.font = 'bold 48px serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(template.title, this.canvas.width / 2, 180);
        
        // Subtitle
        this.ctx.fillStyle = '#64748b';
        this.ctx.font = '24px serif';
        this.ctx.fillText(template.subtitle, this.canvas.width / 2, 220);
        
        // Icon
        this.ctx.font = '80px serif';
        this.ctx.fillText(template.icon, this.canvas.width / 2, 320);
        
        // "This certifies that" text
        this.ctx.fillStyle = '#374151';
        this.ctx.font = '20px serif';
        this.ctx.fillText('This certifies that', this.canvas.width / 2, 380);
        
        // Recipient name
        this.ctx.fillStyle = template.color;
        this.ctx.font = 'bold 36px serif';
        this.ctx.fillText(recipientName, this.canvas.width / 2, 430);
        
        // Description
        this.ctx.fillStyle = '#374151';
        this.ctx.font = '18px serif';
        this.ctx.fillText(template.description, this.canvas.width / 2, 480);
        
        // Performance stats
        const statsY = 540;
        this.ctx.fillStyle = '#64748b';
        this.ctx.font = '16px sans-serif';
        this.ctx.textAlign = 'left';
        
        const statsText = [
            `Final Score: ${score} points`,
            `Accuracy: ${accuracy}%`,
            `Chapters Completed: ${chaptersCompleted}`,
            `Study Time: ${certificateData.studyTime}`,
            `Achievements Earned: ${certificateData.achievements}`
        ];
        
        const startX = 200;
        statsText.forEach((text, index) => {
            this.ctx.fillText(text, startX, statsY + (index * 25));
        });
        
        // Date and signature area
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#374151';
        this.ctx.font = '16px serif';
        this.ctx.fillText(`Issued on ${issueDate}`, this.canvas.width / 2, 680);
        
        // Signature line
        this.ctx.strokeStyle = '#d1d5db';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2 - 100, 720);
        this.ctx.lineTo(this.canvas.width / 2 + 100, 720);
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#64748b';
        this.ctx.font = '14px serif';
        this.ctx.fillText('Interactive English Learning Platform', this.canvas.width / 2, 740);
        
        // Certificate ID (small, bottom right)
        this.ctx.textAlign = 'right';
        this.ctx.fillStyle = '#9ca3af';
        this.ctx.font = '10px monospace';
        this.ctx.fillText(`Certificate ID: ${certificateData.id}`, this.canvas.width - 60, this.canvas.height - 60);
        
        return this.canvas.toDataURL('image/png');
    }

    createDownloadUrl(imageDataUrl, certificateId) {
        const link = document.createElement('a');
        link.download = `certificate-${certificateId}.png`;
        link.href = imageDataUrl;
        return link;
    }

    async downloadCertificate(userId, type = 'completion', customData = {}) {
        try {
            const result = await this.generateCertificate(userId, type, customData);
            
            // Create download link and trigger download
            const link = this.createDownloadUrl(result.imageDataUrl, result.certificateData.id);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            return result;
            
        } catch (error) {
            console.error('Error downloading certificate:', error);
            throw error;
        }
    }

    async getUserCertificates(userId) {
        try {
            // In a real implementation, you'd query certificates by userId
            // For now, we'll return a placeholder
            return [];
        } catch (error) {
            console.error('Error getting user certificates:', error);
            return [];
        }
    }

    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m`;
        } else {
            return `${seconds}s`;
        }
    }

    // Check if user is eligible for certificate
    async checkCertificateEligibility(userId) {
        try {
            const userProgressDoc = await getDoc(doc(db, "userProgress", userId));
            const userStatsDoc = await getDoc(doc(db, "userStats", userId));
            
            if (!userProgressDoc.exists()) {
                return { eligible: false, reason: 'No progress data found' };
            }
            
            const progressData = userProgressDoc.data();
            const statsData = userStatsDoc.exists() ? userStatsDoc.data() : {};
            
            const chaptersCompleted = progressData.completedChapters?.length || 0;
            const totalQuestions = statsData.totalQuestions || 0;
            const accuracy = totalQuestions > 0 
                ? (statsData.correctAnswers / totalQuestions) * 100
                : 0;
            
            // Minimum requirements for certificate
            const minChapters = 2;
            const minQuestions = 10;
            const minAccuracy = 60;
            
            if (chaptersCompleted < minChapters) {
                return { 
                    eligible: false, 
                    reason: `Complete at least ${minChapters} chapters (${chaptersCompleted}/${minChapters})` 
                };
            }
            
            if (totalQuestions < minQuestions) {
                return { 
                    eligible: false, 
                    reason: `Answer at least ${minQuestions} questions (${totalQuestions}/${minQuestions})` 
                };
            }
            
            if (accuracy < minAccuracy) {
                return { 
                    eligible: false, 
                    reason: `Achieve at least ${minAccuracy}% accuracy (${Math.round(accuracy)}%/${minAccuracy}%)` 
                };
            }
            
            return { 
                eligible: true, 
                stats: {
                    chaptersCompleted,
                    totalQuestions,
                    accuracy: Math.round(accuracy),
                    score: progressData.score || 0
                }
            };
            
        } catch (error) {
            console.error('Error checking certificate eligibility:', error);
            return { eligible: false, reason: 'Error checking eligibility' };
        }
    }
}

export default CertificateSystem;

