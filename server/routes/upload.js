const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/', authMiddleware, (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File quá lớn (tối đa 10MB)' });
            }
            return res.status(400).json({ message: err.message || 'Lỗi upload file' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Không có file được tải lên' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        let fileType = 'file';

        if (req.file.mimetype.startsWith('image/')) {
            fileType = 'image';
        } else if (req.file.mimetype.startsWith('video/')) {
            fileType = 'video';
        } else if (req.file.mimetype.startsWith('audio/')) {
            fileType = 'audio';
        }

        res.json({
            url: fileUrl,
            filename: req.file.originalname,
            type: fileType,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
    });
});

module.exports = router;
