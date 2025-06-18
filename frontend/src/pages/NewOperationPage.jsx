// src/pages/NewOperationPage.jsx
import React, { useState } from 'react'; // Artık operationNumber, name, type için useState'e gerek yok
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form'; // useForm hook'unu import et
import { toast } from 'react-toastify';
import { createOperation } from '../services/operationService';

const NewOperationPage = () => {
    const {
        register,          // Input'ları forma kaydetmek için
        handleSubmit,      // Form gönderimini yönetmek için
        formState: { errors, isSubmitting }, // Form hataları ve gönderim durumu
        reset,             // Formu sıfırlamak için
    } = useForm({
        defaultValues: { // Form için varsayılan değerler
            operationNumber: '',
            name: '',
            type: 'ithalat',
        }
    });

    // const [loading, setLoading] = useState(false); // isSubmitting bunu karşılayacak
    // Eskiden kullandığımız error ve successMessage state'leri zaten toast ile yönetiliyor.

    const navigate = useNavigate();

    const onSubmit = async (data) => {
        // data objesi formdaki inputların değerlerini içerir (register ile belirtilen isimlerle)
        // console.log(data); // Form verilerini görmek için

        // react-hook-form'dan gelen data'da boşluk olabilir, trim edelim
        const operationData = {
            operationNumberInput: data.operationNumber.trim(),
            name: data.name.trim(),
            type: data.type,
        };

        // Client-side validasyon (register içinde yapıldığı için burada basit bir kontrol yeterli)
        // Aslında register içindeki required bu kontrolü zaten yapar ama ek bir önlem.
        if (!operationData.operationNumberInput || !operationData.name) {
             toast.error('Operasyon Numarası ve Operasyon Adı alanları zorunludur.');
             return;
        }

        try {
            const newOp = await createOperation(operationData);
            toast.success(`Operasyon "${newOp.name}" başarıyla oluşturuldu!`);
            reset(); // Formu varsayılan değerlere sıfırla
            setTimeout(() => navigate(`/operations/${newOp.id}`), 1500);
        } catch (err) {
            const errorMessage = err.message || (err.error ? err.error : 'Operasyon oluşturulurken bir hata oluştu.');
            toast.error(errorMessage);
            console.error(err);
        }
        // isSubmitting state'i react-hook-form tarafından otomatik yönetilir.
    };

    return (
        <div className="new-operation-page">
            <h1>Yeni Operasyon Oluştur</h1>

            {/* Form gönderimi onSubmit(data) fonksiyonunu çağırır */}
            <form onSubmit={handleSubmit(onSubmit)} className="operation-form">
                <div className="form-group">
                    <label htmlFor="operationNumber">Operasyon Numarası:</label>
                    <input
                        type="text"
                        id="operationNumber"
                        {...register("operationNumber", { // Input'u forma kaydet ve validasyon kuralları ekle
                            required: "Operasyon numarası zorunludur.",
                            minLength: {
                                value: 3,
                                message: "Operasyon numarası en az 3 karakter olmalıdır."
                            },
                            pattern: { // Örnek bir pattern (Sadece büyük harf, rakam ve tire)
                                 value: /^[A-Z0-9-]+$/,
                                 message: "Geçersiz karakterler. Sadece büyük harf, rakam ve tire kullanın."
                             }
                        })}
                        disabled={isSubmitting}
                        // value ve onChange artık react-hook-form tarafından yönetiliyor
                    />
                    {/* Hata mesajını göster */}
                    {errors.operationNumber && <p className="error-text">{errors.operationNumber.message}</p>}
                </div>

                <div className="form-group">
                    <label htmlFor="name">Operasyon Adı:</label>
                    <input
                        type="text"
                        id="name"
                        {...register("name", {
                            required: "Operasyon adı zorunludur.",
                            minLength: {
                                value: 5,
                                message: "Operasyon adı en az 5 karakter olmalıdır."
                            }
                        })}
                        disabled={isSubmitting}
                    />
                    {errors.name && <p className="error-text">{errors.name.message}</p>}
                </div>

                <div className="form-group">
                    <label htmlFor="type">Operasyon Tipi:</label>
                    <select
                        id="type"
                        {...register("type", { required: true })} // Select için de register
                        disabled={isSubmitting}
                        // defaultValue="ithalat" defaultValues ile ayarlandı
                    >
                        <option value="ithalat">İthalat</option>
                        <option value="ihracat">İhracat</option>
                    </select>
                    {/* Select için hata mesajı nadiren gerekir ama eklenebilir */}
                </div>

                <button type="submit" disabled={isSubmitting} className="button primary-button">
                    {isSubmitting ? 'Oluşturuluyor...' : 'Operasyon Oluştur'}
                </button>
            </form>
        </div>
    );
};

export default NewOperationPage;