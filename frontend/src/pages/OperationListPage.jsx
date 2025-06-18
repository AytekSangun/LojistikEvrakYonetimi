// src/pages/OperationListPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getAllOperations } from '../services/operationService';
import './OperationListPage.css';

const OperationListPage = () => {
    const [operations, setOperations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Arama ve Filtreleme State'leri
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    // Sayfalama State'leri
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0); // Backend'den toplam sayfa sayısını alacağız
    const [itemsPerPage, setItemsPerPage] = useState(5); // Sayfa başına gösterilecek öğe sayısı

    // Sıralama State'leri
    const [sortBy, setSortBy] = useState('createdAt'); // Varsayılan sıralama alanı
    const [sortOrder, setSortOrder] = useState('desc'); // Varsayılan sıralama yönü ('asc' veya 'desc')

    const searchInputRef = useRef(null); // Arama input'u için ref

    const fetchOperations = useCallback(async () => {
    try {
        setLoading(true);
        setError(null);
        const params = {
            page: currentPage,
            limit: itemsPerPage,
            sortBy: sortBy,
            sortOrder: sortOrder,
        };
        if (searchTerm.trim()) {
            params.searchTerm = searchTerm.trim();
        }
        if (typeFilter && typeFilter !== 'all' && typeFilter !== '') { // "" de 'all' gibi davranır
            params.typeFilter = typeFilter;
        }

        const responseData = await getAllOperations(params); // responseData artık { operations, currentPage, totalPages, totalItems }

        setOperations(responseData.operations);
        setTotalPages(responseData.totalPages);
        // setCurrentPage(responseData.currentPage); // Backend'den geleni kullanmak daha senkronize olabilir, ama state'imiz zaten doğru olmalı.
                                               // Eğer backend'den gelen sayfa, bizim state'imizden farklıysa bir sorun var demektir.
                                               // Şimdilik kendi state'imize güvenelim.

    } catch (err) {
        setError(err.message || 'Operasyonlar yüklenirken bir hata oluştu.');
        console.error(err);
        setOperations([]);
        setTotalPages(0);
    } finally {
        setLoading(false);
    }
}, [searchTerm, typeFilter, currentPage, itemsPerPage, sortBy, sortOrder]);

    useEffect(() => {
        fetchOperations();
    }, [fetchOperations]);

    // YENİ useEffect: Loading bittiğinde ve arama input'u varsa focus yap
    useEffect(() => {
        // isModalOpen gibi bir kontrol burada yok çünkü bu sayfada ana bir modal yok (şimdilik)
        if (!loading && searchTerm.trim() && searchInputRef.current) {
            const timerId = setTimeout(() => {
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            }, 50);
            return () => clearTimeout(timerId);
        }
    }, [loading, searchTerm]); // Sadece loading ve searchTerm'e bağlı

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1); // Arama yapıldığında ilk sayfaya dön
    };

    const handleFilterChange = (e) => {
        setTypeFilter(e.target.value);
        setCurrentPage(1); // Filtre değiştiğinde ilk sayfaya dön
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleSort = (newSortBy) => {
        // Eğer aynı alana tekrar tıklanırsa sıralama yönünü değiştir
        if (sortBy === newSortBy) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            // Yeni bir alana tıklanırsa, o alana göre artan sırada başla
            setSortBy(newSortBy);
            setSortOrder('asc');
        }
        setCurrentPage(1); // Sıralama değiştiğinde ilk sayfaya dön
    };

    // Sayfa numaralarını oluşturmak için bir helper
    const renderPageNumbers = () => {
        if (totalPages <= 1) return null;
        const pageNumbers = [];
        // Basit sayfalama, daha karmaşık (örn: '...' ile kısaltma) yapılabilir
        for (let i = 1; i <= totalPages; i++) {
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

    const getSortIndicator = (columnName) => {
        if (sortBy === columnName) {
            return sortOrder === 'asc' ? ' ▲' : ' ▼';
        }
        return '';
    };


    if (loading && operations.length === 0 && currentPage === 1) {
        return <div className="loading-message">Yükleniyor...</div>;
    }
    if (error) return <div className="error-message">Hata: {error}</div>;

    return (
        <div className="operation-list-page">
            <div className="page-header">
                <h1>Operasyonlar</h1>
                <Link to="/operations/new" className="button primary-button">
                    Yeni Operasyon Ekle
                </Link>
            </div>

            <div className="filters-container">
                {/* ... (arama ve filtre inputları aynı) ... */}
                <input
                    ref={searchInputRef} // Ref'i input'a ata
                    type="text"
                    placeholder="Operasyon Adı/No Ara..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="search-input"
                />
                <select
                    value={typeFilter}
                    onChange={handleFilterChange}
                    className="filter-select"
                >
                    <option value="">Tüm Tipler</option>
                    <option value="ithalat">İthalat</option>
                    <option value="ihracat">İhracat</option>
                </select>
            </div>

            {loading && <div className="loading-inline">Liste güncelleniyor...</div>}

            {operations.length === 0 && !loading ? (
                <p>Kriterlere uygun operasyon bulunmamaktadır.</p>
            ) : (
                <>
                    <table className="operations-table sortable">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('operationNumber')}>
                                    Operasyon No{getSortIndicator('operationNumber')}
                                </th>
                                <th onClick={() => handleSort('name')}>
                                    Operasyon Adı{getSortIndicator('name')}
                                </th>
                                <th onClick={() => handleSort('type')}>
                                    Tipi{getSortIndicator('type')}
                                </th>
                                <th onClick={() => handleSort('createdAt')}>
                                    Oluşturulma Tarihi{getSortIndicator('createdAt')}
                                </th>
                                <th>Detaylar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {operations.map((op) => (
                                <tr key={op.id}>
                                    <td>{op.operationNumber}</td>
                                    <td>{op.name}</td>
                                    <td>{op.type === 'ithalat' ? 'İthalat' : 'İhracat'}</td>
                                    <td>{new Date(op.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <Link to={`/operations/${op.id}`} className="button-link">
                                            Görüntüle
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="pagination-controls">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1 || totalPages === 0}
                        >
                            Önceki
                        </button>
                        {renderPageNumbers()}
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages || totalPages === 0}
                        >
                            Sonraki
                        </button>
                        {totalPages > 0 && <span className="page-info">Sayfa {currentPage} / {totalPages}</span>}
                    </div>
                </>
            )}
        </div>
    );
};

export default OperationListPage;