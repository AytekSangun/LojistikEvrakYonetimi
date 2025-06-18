// src/services/participantService.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Bir operasyona katılımcı ekle
export const addParticipantToOperation = async (operationId, participantData) => {
    try {
        const response = await axios.post(`${API_URL}/operations/${operationId}/participants`, participantData);
        return response.data;
    } catch (error) {
        console.error("Error adding participant:", error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error("Katılımcı eklenemedi");
    }
};

// Bir katılımcıyı operasyondan çıkar
export const removeParticipantFromOperation = async (operationId, participantId) => {
    try {
        const response = await axios.delete(`${API_URL}/operations/${operationId}/participants/${participantId}`);
        return response.data;
    } catch (error) {
        console.error("Error removing participant:", error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error("Katılımcı çıkarılamadı");
    }
};

// Bir katılımcıya evrak yükle
export const uploadDocumentForParticipant = async (participantId, formData) => {
    // formData zaten bir FormData nesnesi olmalı (dosyayı içeren)
    try {
        const response = await axios.post(`${API_URL}/participants/${participantId}/documents`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error uploading document:", error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error("Evrak yüklenemedi");
    }
};

// Bir evrağı sil
export const deleteDocument = async (documentId) => {
    try {
        // fileRoutes.js'deki endpoint /api/files/documents/:documentId şeklindeydi
        const response = await axios.delete(`${API_URL}/files/documents/${documentId}`);
        return response.data;
    } catch (error) {
        console.error("Error deleting document:", error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error("Evrak silinemedi");
    }
};