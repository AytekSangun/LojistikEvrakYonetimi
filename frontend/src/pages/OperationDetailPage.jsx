// src/pages/OperationDetailPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify'; // toast import edildi
import { getOperationById, updateOperation, deleteOperation } from '../services/operationService';
import {
    addParticipantToOperation,
    removeParticipantFromOperation,
    uploadDocumentForParticipant,
    deleteDocument
} from '../services/participantService';
import { getAllGlobalCompaniesForDropdown } from '../services/globalCompanyService';
import './OperationDetailPage.css';

// Modal Component'i (Daha önce tanımladığımız veya ayrı bir dosyadan import ettiğimiz)
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button onClick={onClose} className="modal-close-button">×</button>
                </div>
                <div className="modal-body">{children}</div>
            </div>
        </div>
    );
};

const OperationDetailPage = () => {
    const { id: operationId } = useParams();
    const navigate = useNavigate();

    const [operation, setOperation] = useState(null);
    const [loading, setLoading] = useState(true); // Genel sayfa yükleme
    const [actionLoading, setActionLoading] = useState(false); // Buton işlemleri için loading
    const [error, setError] = useState(null); // Sayfa geneli hata için

    // Operasyon Düzenleme Modal state'leri
    const [isEditOpModalOpen, setIsEditOpModalOpen] = useState(false);
    const [opName, setOpName] = useState('');
    const [opType, setOpType] = useState('ithalat');
    const [editOpError, setEditOpError] = useState(''); // Modal içi hata

    // Katılımcı Ekleme Modal state'leri
    const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false);
    const [globalCompanies, setGlobalCompanies] = useState([]);
    const [selectedGlobalCompanyId, setSelectedGlobalCompanyId] = useState('');
    const [participantRole, setParticipantRole] = useState('tedarikci');
    const [addParticipantError, setAddParticipantError] = useState(''); // Modal içi hata

    // Evrak Yükleme Modal state'leri
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [currentParticipantForUpload, setCurrentParticipantForUpload] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadError, setUploadError] = useState(''); // Modal içi hata

    // Dosya listesi genişletme state'i
    const [expandedParticipants, setExpandedParticipants] = useState({});

    const fetchOperationDetails = useCallback(async (showLoadingIndicator = true) => {
        if (showLoadingIndicator) setLoading(true);
        setError(null);
        try {
            const data = await getOperationById(operationId);
            setOperation(data);
            if (data) { // Sadece data varsa state'leri set et
                setOpName(data.name);
                setOpType(data.type);
            }
            // Genişletme durumunu sıfırla veya mevcut durumu koru - şimdilik koruyalım
            // setExpandedParticipants({});
        } catch (err) {
            const errorMessage = err.message || (err.error ? err.error : 'Operasyon detayları yüklenirken bir hata oluştu.');
            setError(errorMessage);
            toast.error(errorMessage); // Sayfa yükleme hatasını da toast ile gösterelim
            console.error(err);
        } finally {
            if (showLoadingIndicator) setLoading(false);
        }
    }, [operationId]);

    const fetchGlobalCompanies = useCallback(async () => {
    try {
        // Yeni servisi çağır
        const companiesData = await getAllGlobalCompaniesForDropdown(); // Artık direkt dizi gelmeli

        console.log("OperationDetailPage - fetchGlobalCompanies (tümü) - Gelen Yanıt:", companiesData);

        if (Array.isArray(companiesData)) {
            setGlobalCompanies(companiesData);
        } else {
            console.error("OperationDetailPage - fetchGlobalCompanies (tümü): Beklenen formatta (dizi) veri gelmedi:", companiesData);
            setGlobalCompanies([]);
            toast.error("Modal için firma listesi yüklenirken bir sorun oluştu.");
        }
    } catch (err) {
        const errorMessage = err.message || (err.error ? err.error : "Modal için firmalar yüklenemedi.");
        setAddParticipantError(errorMessage); // Modal içi hata state'ini set et
        toast.error(errorMessage);
        setGlobalCompanies([]); // Hata durumunda boş diziye ayarla
    }
}, []); // Bağımlılık dizisi boş, çünkü bu sadece modal açıldığında bir kere çalışıyor gibi

    useEffect(() => {
        fetchOperationDetails();
    }, [fetchOperationDetails]);

    useEffect(() => {
        if (isAddParticipantModalOpen) {
            fetchGlobalCompanies();
        }
    }, [isAddParticipantModalOpen, fetchGlobalCompanies]);

    const handleOpenEditOpModal = () => {
        if (operation) {
            setOpName(operation.name);
            setOpType(operation.type);
        }
        setEditOpError('');
        setIsEditOpModalOpen(true);
    };

    const handleUpdateOperation = async (e) => {
        e.preventDefault();
        if (!opName.trim()) {
            setEditOpError("Operasyon adı zorunludur."); // Modal içi hata
            return;
        }
        setEditOpError('');
        setActionLoading(true);
        try {
            const updatedData = { name: opName, type: opType };
            await updateOperation(operationId, updatedData);
            toast.success("Operasyon bilgileri başarıyla güncellendi.");
            setIsEditOpModalOpen(false);
            fetchOperationDetails(false); // Sayfayı tam ekran loading olmadan güncelle
        } catch (err) {
            const errorMessage = err.message || (err.error ? err.error : "Operasyon güncellenemedi.");
            setEditOpError(errorMessage); // Modal içi hata
            toast.error(errorMessage);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteOperation = async () => {
        if (operation && window.confirm(`"${operation.name}" adlı operasyonu ve tüm bağlı verilerini silmek istediğinizden emin misiniz?`)) {
            setActionLoading(true);
            try {
                await deleteOperation(operationId);
                toast.success(`Operasyon "${operation.name}" başarıyla silindi.`);
                navigate('/');
            } catch (err) {
                const errorMessage = err.message || (err.error ? err.error : "Operasyon silinirken bir hata oluştu.");
                setError(errorMessage); // Sayfa geneli hata
                toast.error(errorMessage);
            } finally {
                setActionLoading(false);
            }
        }
    };

    const handleAddParticipant = async (e) => {
        e.preventDefault();
        if (!selectedGlobalCompanyId || !participantRole) {
            setAddParticipantError("Lütfen firma ve rol seçin.");
            return;
        }
        setAddParticipantError('');
        setActionLoading(true);
        try {
            const participantData = { globalCompanyId: selectedGlobalCompanyId, role: participantRole };
            const newParticipant = await addParticipantToOperation(operationId, participantData);
            toast.success(`Katılımcı "${newParticipant.globalCompany.name}" başarıyla eklendi.`);
            setIsAddParticipantModalOpen(false);
            setSelectedGlobalCompanyId('');
            setParticipantRole('tedarikci');
            fetchOperationDetails(false); // Sayfayı tam ekran loading olmadan güncelle
        } catch (err) {
            const errorMessage = err.message || (err.error ? err.error : "Katılımcı eklenemedi.");
            setAddParticipantError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveParticipant = async (participantId, participantName) => {
        if (window.confirm(`"${participantName}" adlı katılımcıyı ve tüm evraklarını silmek istediğinizden emin misiniz?`)) {
            setActionLoading(true);
            try {
                await removeParticipantFromOperation(operationId, participantId);
                toast.info(`Katılımcı "${participantName}" operasyondan çıkarıldı.`);
                fetchOperationDetails(false);
            } catch (err) {
                const errorMessage = err.message || (err.error ? err.error : "Katılımcı silinirken hata oluştu.");
                toast.error(errorMessage);
            } finally {
                setActionLoading(false);
            }
        }
    };

    const openUploadModal = (participant) => {
        setCurrentParticipantForUpload(participant);
        setSelectedFile(null);
        setUploadError('');
        setIsUploadModalOpen(true);
    };

    const handleFileUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile || !currentParticipantForUpload) {
            setUploadError("Lütfen bir dosya seçin.");
            return;
        }
        setUploadError('');
        const formData = new FormData();
        formData.append('evrak', selectedFile);
        setActionLoading(true);
        try {
            await uploadDocumentForParticipant(currentParticipantForUpload.id, formData);
            toast.success(`Evrak "${selectedFile.name}" başarıyla yüklendi.`);
            setIsUploadModalOpen(false);
            fetchOperationDetails(false);
        } catch (err) {
            const errorMessage = err.message || (err.error ? err.error : "Dosya yüklenemedi.");
            setUploadError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteDocument = async (documentId, documentName) => {
        if (window.confirm(`"${documentName}" adlı evrağı silmek istediğinizden emin misiniz?`)) {
            setActionLoading(true);
            try {
                await deleteDocument(documentId);
                toast.info(`Evrak "${documentName}" silindi.`);
                fetchOperationDetails(false);
            } catch (err) {
                const errorMessage = err.message || (err.error ? err.error : "Evrak silinirken hata oluştu.");
                toast.error(errorMessage);
            } finally {
                setActionLoading(false);
            }
        }
    };

    const toggleParticipantExpansion = (participantId) => {
        setExpandedParticipants(prev => ({
            ...prev,
            [participantId]: !prev[participantId]
        }));
    };

    if (loading) return <div className="loading-message">Yükleniyor...</div>;
    if (error && !operation) return <div className="error-message">Hata: {error} <Link to="/">Geri Dön</Link></div>; // Eğer operasyon hiç yüklenemediyse
    if (!operation) return <div className="info-message">Operasyon bulunamadı. <Link to="/">Geri Dön</Link></div>;

    return (
        <div className="operation-detail-page">
            <div className="page-header">
                <h1>Operasyon: {operation.name} ({operation.operationNumber})</h1>
                <div>
                    <button onClick={handleOpenEditOpModal} className="button" style={{marginRight: '10px', backgroundColor: '#f39c12'}} disabled={actionLoading}>
                        Operasyonu Düzenle
                    </button>
                    <button onClick={() => setIsAddParticipantModalOpen(true)} className="button primary-button" style={{marginRight: '10px'}} disabled={actionLoading}>
                        Katılımcı Ekle
                    </button>
                    <button onClick={handleDeleteOperation} className="button danger" disabled={actionLoading}>
                        {actionLoading ? 'İşleniyor...' : 'Operasyonu Sil'}
                    </button>
                </div>
            </div>
             {error && <div className="error-message" style={{marginBottom: '1rem'}}>{error}</div>} {/* Operasyon yüklendikten sonra oluşabilecek hatalar için */}


            <p><strong>Tipi:</strong> {operation.type === 'ithalat' ? 'İthalat' : 'İhracat'}</p>
            <p><strong>Oluşturulma Tarihi:</strong> {new Date(operation.createdAt).toLocaleString()}</p>
            <hr />

            <h2>Katılımcı Firmalar</h2>
            {operation.participants && operation.participants.length > 0 ? (
                operation.participants.map((participant) => (
                    <div key={participant.id} className="participant-card">
                        <div className="participant-header clickable" onClick={() => toggleParticipantExpansion(participant.id)}>
                            <h3>
                                {participant.globalCompany.name} <span className="role-badge">{participant.role}</span>
                                <span className="expand-indicator">
                                    {expandedParticipants[participant.id] ? '▼' : '►'}
                                </span>
                            </h3>
                            <div>
                                <button onClick={(e) => { e.stopPropagation(); openUploadModal(participant);}} className="button-small success" disabled={actionLoading}>Evrak Yükle</button>
                                <button onClick={(e) => { e.stopPropagation(); handleRemoveParticipant(participant.id, participant.globalCompany.name);}} className="button-small danger" disabled={actionLoading}>Katılımcıyı Sil</button>
                            </div>
                        </div>

                        {expandedParticipants[participant.id] && (
                            <div className="documents-section">
                                <h4>Evraklar:</h4>
                                {participant.documents && participant.documents.length > 0 ? (
                                    <ul className="document-list">
                                        {participant.documents.map((doc) => (
                                            <li key={doc.id}>
                                                <a href={doc.fullPath} target="_blank" rel="noopener noreferrer">
                                                    {doc.originalFileName}
                                                </a>
                                                <span className="file-info"> ({doc.fileType}, {(doc.fileSize / 1024).toFixed(1)} KB)</span>
                                                <button onClick={() => handleDeleteDocument(doc.id, doc.originalFileName)} className="button-tiny danger" title="Evrağı Sil" disabled={actionLoading}>×</button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>Bu katılımcı için henüz evrak yüklenmemiş.</p>
                                )}
                            </div>
                        )}
                    </div>
                ))
            ) : (
                <p>Bu operasyona henüz katılımcı eklenmemiş.</p>
            )}

            {/* Operasyon Düzenleme Modalı */}
            <Modal isOpen={isEditOpModalOpen} onClose={() => !actionLoading && setIsEditOpModalOpen(false)} title="Operasyon Bilgilerini Düzenle">
                <form onSubmit={handleUpdateOperation}>
                    {editOpError && <p className="error-message" style={{color: 'red'}}>{editOpError}</p>}
                    <div className="form-group">
                        <label htmlFor="opEditName">Operasyon Adı:</label>
                        <input type="text" id="opEditName" value={opName} onChange={(e) => setOpName(e.target.value)} required disabled={actionLoading} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="opEditType">Operasyon Tipi:</label>
                        <select id="opEditType" value={opType} onChange={(e) => setOpType(e.target.value)} disabled={actionLoading}>
                            <option value="ithalat">İthalat</option>
                            <option value="ihracat">İhracat</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                         <button type="button" onClick={() => setIsEditOpModalOpen(false)} className="button" style={{backgroundColor: '#7f8c8d'}} disabled={actionLoading}>İptal</button>
                        <button type="submit" className="button primary-button" disabled={actionLoading}>
                            {actionLoading ? 'Güncelleniyor...' : 'Güncelle'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Katılımcı Ekleme Modalı */}
            <Modal isOpen={isAddParticipantModalOpen} onClose={() => !actionLoading && setIsAddParticipantModalOpen(false)} title="Operasyona Katılımcı Ekle">
                 <form onSubmit={handleAddParticipant}>
                    {addParticipantError && <p className="error-message" style={{color: 'red'}}>{addParticipantError}</p>}
                    <div className="form-group">
                        <label htmlFor="globalCompany">Firma Seçin:</label>
                        <select
                            id="globalCompany"
                            value={selectedGlobalCompanyId}
                            onChange={(e) => setSelectedGlobalCompanyId(e.target.value)}
                            required
                            disabled={actionLoading || !Array.isArray(globalCompanies) || globalCompanies.length === 0}
                        >
                            <option value="" disabled>-- Firma Seçin --</option>
                            {/* globalCompanies artık doğrudan bir dizi olmalı */}
                            {Array.isArray(globalCompanies) && globalCompanies.map(gc => (
                                <option key={gc.id} value={gc.id}>{gc.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="role">Rol:</label>
                        <select id="role" value={participantRole} onChange={(e) => setParticipantRole(e.target.value)} required disabled={actionLoading}>
                            <option value="tedarikci">Tedarikçi</option>
                            <option value="alici">Alıcı</option>
                            <option value="musteri">Müşteri</option>
                        </select>
                    </div>
                    <button type="submit" className="button primary-button" disabled={actionLoading}>
                        {actionLoading ? 'Ekleniyor...' : 'Ekle'}
                    </button>
                </form>
            </Modal>

            {/* Evrak Yükleme Modalı */}
            {currentParticipantForUpload && (
                <Modal isOpen={isUploadModalOpen} onClose={() => !actionLoading && setIsUploadModalOpen(false)} title={`${currentParticipantForUpload.globalCompany.name} (${currentParticipantForUpload.role}) İçin Evrak Yükle`}>
                    <form onSubmit={handleFileUpload}>
                        {uploadError && <p className="error-message" style={{color: 'red'}}>{uploadError}</p>}
                        <div className="form-group">
                            <label htmlFor="evrakFile">Dosya Seçin:</label>
                            <input type="file" id="evrakFile" onChange={(e) => setSelectedFile(e.target.files[0])} required disabled={actionLoading} />
                        </div>
                        <button type="submit" className="button primary-button" disabled={actionLoading}>
                            {actionLoading ? 'Yükleniyor...' : 'Yükle'}
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default OperationDetailPage;