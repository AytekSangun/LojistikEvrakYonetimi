// src/services/operationService.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'; // .env dosyasından okuyacağız

// Tüm operasyonları getir
export const getAllOperations = async (params = {}) => {
    // params objesi: { searchTerm: 'ABC', typeFilter: 'ithalat' } gibi olabilir
    try {
        const response = await axios.get(`${API_URL}/operations`, { params }); // query string olarak gönderir
        return response.data;
    } catch (error) {
        console.error("Error fetching operations:", error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error("Operasyonlar getirilemedi");
    }
};

// Yeni operasyon oluştur (ileride kullanacağız)
export const createOperation = async (operationData) => {
    try {
        const response = await axios.post(`${API_URL}/operations`, operationData);
        return response.data;
    } catch (error) {
        console.error("Error creating operation:", error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error("Operasyon oluşturulamadı");
    }
};

// Tek bir operasyon detayını getir (ileride kullanacağız)
export const getOperationById = async (id) => {
    try {
        const response = await axios.get(`${API_URL}/operations/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching operation ${id}:`, error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error(`Operasyon ${id} getirilemedi`);
    }
};

export const updateOperation = async (id, operationData) => {
    // operationData sadece { name, type } içermeli
    try {
        const response = await axios.put(`${API_URL}/operations/${id}`, operationData);
        return response.data;
    } catch (error) {
        console.error(`Error updating operation ${id}:`, error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error("Operasyon güncellenemedi");
    }
};

// deleteOperation servisini de ekleyebiliriz (ileride lazım olursa)
export const deleteOperation = async (id) => {
    try {
        const response = await axios.delete(`${API_URL}/operations/${id}`);
        return response.data; // { message: "..." }
    } catch (error) {
        console.error(`Error deleting operation ${id}:`, error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error("Operasyon silinemedi");
    }
};