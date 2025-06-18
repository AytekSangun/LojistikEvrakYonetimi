// src/services/globalCompanyService.js
import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const getAllGlobalCompanies = async (params = {}) => {
    try {
        const response = await axios.get(`${API_URL}/global-companies`, { params });
        // Backend'den gelen yanıtın tamamını (yani objeyi) döndür
        return response.data;
    } catch (error) {
        console.error("Error fetching global companies:", error.response ? error.response.data : error.message);
        // Hata objesini daha anlamlı hale getirebiliriz
        const errorMessage = error.response?.data?.error || error.message || "Global firmalar getirilemedi";
        throw new Error(errorMessage); // new Error() ile sarmalayarak fırlatmak daha standart
    }
};

export const getAllGlobalCompaniesForDropdown = async () => { // Veya fetchAllCompanies gibi bir isim
    try {
        // Yeni endpoint'i çağır
        const response = await axios.get(`${API_URL}/global-companies/all`);
        return response.data; // Bu direkt firma dizisini döndürmeli
    } catch (error) {
        console.error("Error fetching all global companies for dropdown:", error.response ? error.response.data : error.message);
        const errorMessage = error.response?.data?.error || error.message || "Tüm firmalar getirilemedi";
        throw new Error(errorMessage);
    }
};

export const createGlobalCompany = async (companyData) => {
    try {
        const response = await axios.post(`${API_URL}/global-companies`, companyData);
        return response.data;
    } catch (error) {
        console.error("Error creating global company:", error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error("Global firma oluşturulamadı");
    }
};

export const updateGlobalCompany = async (id, companyData) => {
    try {
        const response = await axios.put(`${API_URL}/global-companies/${id}`, companyData);
        return response.data;
    } catch (error) {
        console.error(`Error updating global company ${id}:`, error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error("Global firma güncellenemedi");
    }
};

export const deleteGlobalCompany = async (id) => {
    try {
        const response = await axios.delete(`${API_URL}/global-companies/${id}`);
        return response.data; // Genellikle bir mesaj döner: { message: "..." }
    } catch (error) {
        console.error(`Error deleting global company ${id}:`, error.response ? error.response.data : error.message);
        throw error.response ? error.response.data : new Error("Global firma silinemedi. Firma bir veya daha fazla operasyona bağlı olabilir.");
    }
};