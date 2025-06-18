// src/pages/GlobalCompanyListPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form'; // useForm'u import etmeyi unutmayın
import { toast } from 'react-toastify';
import {
    getAllGlobalCompanies,
    createGlobalCompany,
    updateGlobalCompany,
    deleteGlobalCompany
} from '../services/globalCompanyService';
import './GlobalCompanyListPage.css'; // Stil dosyasını import ettiğinizden emin olun

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

// CompanyForm Component'i (react-hook-form ile güncellenmiş)
const CompanyForm = ({ onSubmitForm, initialData = {}, onCancel, submitButtonText = "Kaydet", isFormSubmitting }) => {
    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm({
        defaultValues: initialData // defaultValues'u doğrudan initialData ile set et
    });

    // initialData değiştiğinde formu resetle
    useEffect(() => {
        reset(initialData);
    }, [initialData, reset]);

    const handleLocalSubmit = (data) => {
        const processedData = {
            name: data.name.trim(),
            address: data.address ? data.address.trim() : '',
            taxNumber: data.taxNumber ? data.taxNumber.trim() : '',
            contact: data.contact ? data.contact.trim() : ''
        };
        onSubmitForm(processedData); // Parent'a gönderilen prop adı onSubmitForm
    };

    return (
        <form onSubmit={handleSubmit(handleLocalSubmit)}>
            <div className="form-group">
                <label htmlFor="companyNameModalForm">Firma Adı:</label>
                <input
                    type="text"
                    id="companyNameModalForm"
                    {...register("name", {
                        required: "Firma adı zorunludur."
                    })}
                    disabled={isFormSubmitting}
                />
                {errors.name && <p className="error-text">{errors.name.message}</p>}
            </div>
            <div className="form-group">
                <label htmlFor="companyAddressModalForm">Adres:</label>
                <input
                    type="text"
                    id="companyAddressModalForm"
                    {...register("address")}
                    disabled={isFormSubmitting}
                />
            </div>
            <div className="form-group">
                <label htmlFor="companyTaxNumberModalForm">Vergi Numarası:</label>
                <input
                    type="text"
                    id="companyTaxNumberModalForm"
                    {...register("taxNumber")}
                    disabled={isFormSubmitting}
                />
            </div>
            <div className="form-group">
                <label htmlFor="companyContactModalForm">İletişim:</label>
                <input
                    type="text"
                    id="companyContactModalForm"
                    {...register("contact")}
                    disabled={isFormSubmitting}
                />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={onCancel} className="button" style={{backgroundColor: '#7f8c8d'}} disabled={isFormSubmitting}>İptal</button>
                <button type="submit" className="button primary-button" disabled={isFormSubmitting}>
                    {isFormSubmitting ? 'İşleniyor...' : submitButtonText}
                </button>
            </div>
        </form>
    );
};


const GlobalCompanyListPage = () => {
    const [companies, setCompanies] = useState([]);
    const [pageLoading, setPageLoading] = useState(true); // Sayfa ilk yüklenirken
    const [listLoading, setListLoading] = useState(false); // Liste güncellenirken (arama, sayfa değişimi vs.)
    const [listError, setListError] = useState(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState(null);
    const [formSubmitError, setFormSubmitError] = useState('');
    const [isFormSubmitting, setIsFormSubmitting] = useState(false);

    const searchInputRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(5);
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');

    const fetchCompanies = useCallback(async (isInitialLoad = false) => {
        console.log("fetchCompanies BAŞLANGIÇ, companies state:", companies); // DEBUG
        if (isInitialLoad) {
            setPageLoading(true);
        } else {
            setListLoading(true);
        }
        setListError(null);
        try {
            const params = {
                page: currentPage,
                limit: itemsPerPage,
                sortBy: sortBy,
                sortOrder: sortOrder,
            };
            if (searchTerm.trim()) {
                params.searchTerm = searchTerm.trim();
            }

            const responseData = await getAllGlobalCompanies(params);
            if (responseData && typeof responseData.totalPages === 'number' && Array.isArray(responseData.companies)) {
            setCompanies(responseData.companies);
            setTotalPages(responseData.totalPages);
        } else {
            console.error("fetchCompanies: Beklenmeyen responseData formatı veya totalPages eksik/hatalı:", responseData);
            setCompanies([]);
            setTotalPages(0); // Hata veya eksik veri durumunda sıfırla
        }
        } catch (err) {
            setListError(err.message || 'Firmalar yüklenirken bir hata oluştu.');
            setCompanies([]);
            setTotalPages(0);
        } finally {
            if (isInitialLoad) {
                setPageLoading(false);
            }
            setListLoading(false);
        }
    }, [searchTerm, currentPage, itemsPerPage, sortBy, sortOrder]);

    useEffect(() => {
        fetchCompanies(true); // İlk yükleme için true gönder
    }, [fetchCompanies]); // fetchCompanies bağımlılıkları değişince de çalışacak

    useEffect(() => {
        if (!pageLoading && !listLoading && searchTerm.trim() && searchInputRef.current && !isModalOpen) {
            const timerId = setTimeout(() => {
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            }, 50);
            return () => clearTimeout(timerId);
        }
    }, [pageLoading, listLoading, searchTerm, isModalOpen]);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handlePageChange = (newPage) => {
    // DEBUG: Fonksiyon çağrıldığında ve değerleri kontrol et
    console.log(`handlePageChange çağrıldı: newPage=${newPage}, currentPage=${currentPage}, totalPages=${totalPages}`);

    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
        setCurrentPage(newPage); // Bu, fetchCompanies'i yeniden tetiklemeli (çünkü currentPage bağımlılık dizisinde)
    } else {
        console.log("Sayfa değiştirme koşulları sağlanmadı veya zaten o sayfada.");
    }
};

    const handleSort = (newSortBy) => {
        if (sortBy === newSortBy) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(newSortBy);
            setSortOrder('asc');
        }
        setCurrentPage(1);
    };

    const getSortIndicator = (columnName) => {
        if (sortBy === columnName) {
            return sortOrder === 'asc' ? ' ▲' : ' ▼';
        }
        return '';
    };

    const renderPageNumbers = () => {
        if (totalPages <= 1) return null;
        const pageNumbers = [];
        const maxPagesToShow = 5; // Gösterilecek maksimum sayfa sayısı butonu
        let startPage, endPage;

        if (totalPages <= maxPagesToShow) {
            startPage = 1;
            endPage = totalPages;
        } else {
            if (currentPage <= Math.ceil(maxPagesToShow / 2)) {
                startPage = 1;
                endPage = maxPagesToShow;
            } else if (currentPage + Math.floor(maxPagesToShow / 2) >= totalPages) {
                startPage = totalPages - maxPagesToShow + 1;
                endPage = totalPages;
            } else {
                startPage = currentPage - Math.floor(maxPagesToShow / 2);
                endPage = currentPage + Math.floor(maxPagesToShow / 2);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            pageNumbers.push(
                <button
                    key={i}
                    onClick={() => handlePageChange(i)}
                    disabled={i === currentPage}
                    className={`page-button ${i === currentPage ? 'active' : ''}`}
                >
                    {i}
                </button>
            );
        }
        return pageNumbers;
    };

    const handleOpenModalForNew = () => {
        setEditingCompany(null);
        setFormSubmitError('');
        setIsModalOpen(true);
    };

    const handleOpenModalForEdit = (company) => {
        setEditingCompany(company); // Bu, CompanyForm'daki useEffect'i tetikleyip formu dolduracak
        setFormSubmitError('');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCompany(null);
        setFormSubmitError('');
    };

    const handleFormSubmitCallback = async (companyData) => {
        setIsFormSubmitting(true);
        setFormSubmitError('');
        try {
            if (editingCompany && editingCompany.id) {
                await updateGlobalCompany(editingCompany.id, companyData);
                toast.success(`Firma "${companyData.name}" başarıyla güncellendi.`);
            } else {
                await createGlobalCompany(companyData);
                toast.success(`Firma "${companyData.name}" başarıyla oluşturuldu.`);
            }
            handleCloseModal();
            fetchCompanies();
        } catch (err) {
            const errorMessage = err.message || (err.error ? err.error : (editingCompany ? "Firma güncellenemedi." : "Firma oluşturulamadı."));
            setFormSubmitError(errorMessage); // Modal içindeki hata için
            // toast.error(errorMessage); // Zaten setFormSubmitError ile modal içinde gösteriliyor, tekrar toast'a gerek yok gibi
        } finally {
            setIsFormSubmitting(false);
        }
    };

    const handleDeleteCompany = async (companyId, companyName) => {
        if (window.confirm(`'${companyName}' adlı firmayı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
            setListError(null);
            try {
                await deleteGlobalCompany(companyId);
                toast.info(`Firma "${companyName}" silindi.`);
                // Eğer silinen firma son sayfadaki tek firmaysa ve o sayfa artık boşsa, bir önceki sayfaya git
                if (companies.length === 1 && currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                } else {
                    fetchCompanies(); // Mevcut sayfada kal ve listeyi yenile
                }
            } catch (err) {
                const errorMessage = err.message || (err.error ? err.error : "Firma silinemedi.");
                setListError(errorMessage);
                toast.error(errorMessage);
            }
        }
    };

    if (pageLoading) {
        return <div className="loading-message">Yükleniyor...</div>;
    }

    return (
        <div className="global-company-list-page">
            <div className="page-header">
                <h1>Global Firmalar</h1>
                <button onClick={handleOpenModalForNew} className="button primary-button">
                    Yeni Firma Ekle
                </button>
            </div>

            {listError && <div className="error-message" style={{marginBottom: '1rem'}}>{listError}</div>}

            <div className="filters-container">
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Firma Adı, Adres, Vergi No Ara..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="search-input"
                />
            </div>

            {listLoading && <div className="loading-inline">Liste güncelleniyor...</div>}

            {!listLoading && !Array.isArray(companies) ? (
                <p>Firma verileri yüklenirken bir sorun oluştu veya veri formatı hatalı.</p>
            ) : !listLoading && companies.length === 0 ? (
            <p>Kriterlere uygun firma bulunmamaktadır veya hiç firma yok.</p>
            ) : !listLoading && companies.length > 0 ? (
                <>
                    <table className="companies-table sortable">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('name')}>Firma Adı{getSortIndicator('name')}</th>
                                <th onClick={() => handleSort('address')}>Adres{getSortIndicator('address')}</th>
                                <th onClick={() => handleSort('taxNumber')}>Vergi No{getSortIndicator('taxNumber')}</th>
                                <th onClick={() => handleSort('contact')}>İletişim{getSortIndicator('contact')}</th>
                                <th onClick={() => handleSort('createdAt')}>Eklenme Tarihi{getSortIndicator('createdAt')}</th>
                                <th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {companies.map((company) => (
                                <tr key={company.id}>
                                    <td>{company.name}</td>
                                    <td>{company.address || '-'}</td>
                                    <td>{company.taxNumber || '-'}</td>
                                    <td>{company.contact || '-'}</td>
                                    <td>{new Date(company.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <button onClick={() => handleOpenModalForEdit(company)} className="button-small" style={{marginRight: '5px', backgroundColor: '#f39c12'}}>Düzenle</button>
                                        <button onClick={() => handleDeleteCompany(company.id, company.name)} className="button-small danger">Sil</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="pagination-controls">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1 || totalPages === 0 || listLoading}
                        >
                            Önceki
                        </button>
                        {renderPageNumbers()}
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages || totalPages === 0 || listLoading}
                        >
                            Sonraki
                        </button>
                        {totalPages > 0 && <span className="page-info">Sayfa {currentPage} / {totalPages}</span>}
                    </div>
                </>
            ) : null } {/* Eğer listLoading false ama companies hala boşsa (ilk yükleme sonrası) burası null olur ve yukarıdaki mesaj görünür */}


            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingCompany ? "Firmayı Düzenle" : "Yeni Firma Ekle"}>
                {formSubmitError && <p className="error-message" style={{color: 'red', marginBottom: '10px'}}>{formSubmitError}</p>}
                <CompanyForm
                    onSubmitForm={handleFormSubmitCallback} // Prop adını değiştirdim, daha anlaşılır
                    initialData={editingCompany || {}}
                    onCancel={handleCloseModal}
                    submitButtonText={editingCompany ? "Güncelle" : "Oluştur"}
                    isFormSubmitting={isFormSubmitting}
                />
            </Modal>
        </div>
    );
};

export default GlobalCompanyListPage;