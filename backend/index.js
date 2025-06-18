// backend/index.js
require('dotenv').config(); // .env dosyasındaki değişkenleri yükler
const express = require('express');
const cors = require('cors');
const path = require('path'); // path modülünü ekledik
const authRoutes = require('./routes/authRoutes'); // YENİ

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware'ler
app.use(cors()); // CORS'u etkinleştir
app.use(express.json()); // Gelen JSON request'lerini parse eder
app.use(express.urlencoded({ extended: true })); // Gelen URL-encoded request'leri parse eder

app.use('/api/auth', authRoutes); // YENİ

// Statik dosya sunumu için (yüklenen evrakları erişilebilir yapmak için)
// '/uploads' yolunu, sunucudaki 'uploads' klasörüne eşle
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Route'ları import et
const operationRoutes = require('./routes/operationRoutes');
// const companyRoutes = require('./routes/companyRoutes');
const documentRoutes = require('./routes/documentRoutes');
const fileManagementRoutes = require('./routes/fileRoutes');
const globalCompanyRoutes = require('./routes/globalCompanyRoutes');
const participantRoutes = require('./routes/participantRoutes'); // YENİ

// API route'larını kullan
// Önce genel operation route'ları
app.use('/api/global-companies', globalCompanyRoutes);
app.use('/api/operations', operationRoutes);

app.use('/api/operations/:operationId/participants', participantRoutes);

app.use('/api/participants/:participantId/documents', documentRoutes); // Katılımcıya bağlı evraklar için

app.use('/api/files', fileManagementRoutes);


// Temel bir route
app.get('/', (req, res) => {
  res.send('Lojistik Evrak Yönetimi API Çalışıyor!');
});

// TODO: Diğer route'lar buraya eklenecek (operations, companies, documents)

app.listen(PORT, () => {
  console.log(`Backend sunucusu http://localhost:${PORT} adresinde çalışıyor.`);
});