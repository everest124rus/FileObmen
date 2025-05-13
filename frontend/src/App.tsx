import React, { useState, useCallback, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Paper, 
  TextField, 
  Button, 
  Snackbar,
  Alert,
  CircularProgress,
  useTheme,
  Grid,
  keyframes,
  MenuItem,
  Select,
  InputLabel,
  FormControl
} from '@mui/material';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { styled } from '@mui/material/styles';
import { QRCodeCanvas } from 'qrcode.react';

const API_URL = 'http://localhost:8000';

// Анимация для фона (эффект флага)
const flagWave = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

// Стилизованный контейнер для анимированного фона
const AnimatedBackground = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  background: 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)',
  backgroundSize: '400% 400%',
  animation: `${flagWave} 18s ease-in-out infinite`,
  padding: theme.spacing(4),
}));

// Стилизованная карточка
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: 16,
  background: 'rgba(255, 255, 255, 0.98)',
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
  maxWidth: 420,
  margin: '0 auto',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
    maxWidth: '100%',
  },
}));

// Стилизованная кнопка
const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: 25,
  padding: '12px 30px',
  textTransform: 'none',
  fontSize: '1.1rem',
  transition: 'all 0.3s ease',
  [theme.breakpoints.down('sm')]: {
    fontSize: '1rem',
    padding: '10px 0',
    minWidth: 0,
  },
  '&:hover': {
    transform: 'scale(1.05)',
    boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
  },
}));

const EXPIRE_OPTIONS = [
  { value: '5m', label: '5 минут' },
  { value: '15m', label: '15 минут' },
  { value: '1h', label: '1 час' },
  { value: '12h', label: '12 часов' },
  { value: '24h', label: '1 сутки' },
];
const MAX_FILE_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5 GB

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [fileId, setFileId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);
  const [expire, setExpire] = useState('1h');
  const [expiresAt, setExpiresAt] = useState<number|null>(null);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const theme = useTheme();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false
  });

  const handleUpload = async () => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError('Файл слишком большой (максимум 1.5 ГБ)');
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('expire', expire);
    if (password) {
      formData.append('password', password);
    }
    try {
      const response = await axios.post(`${API_URL}/upload`, formData);
      setFileId(response.data.file_id);
      setMessage(`Файл успешно загружен! Ваш логин: ${response.data.file_id}`);
      setShowUploadSuccess(true);
      setExpiresAt(response.data.expires_at);
      setFile(null);
      setPassword('');
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Ошибка при загрузке файла');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(fileId);
    setMessage('Логин скопирован!');
  };

  const handleUploadAnother = () => {
    setShowUploadSuccess(false);
    setFileId('');
    setMessage('');
    setError('');
  };

  const handleDownload = async () => {
    if (!fileId) return;

    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/download/${fileId}`, {
        params: { password },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file?.name || 'file');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage('Файл успешно скачан!');
    } catch (err) {
      setError('Ошибка при скачивании файла');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      let diff = expiresAt - now;
      if (diff < 0) diff = 0;
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      let str = '';
      if (hours > 0) str += `${hours} ч. `;
      if (minutes > 0 || hours > 0) str += `${minutes} мин. `;
      str += `${seconds} сек.`;
      setTimeLeft(str);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <>
      <AnimatedBackground>
        <Container maxWidth="sm" sx={{ minWidth: 0, p: { xs: 0.5, sm: 2 } }}>
          <StyledPaper>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              align="center"
              sx={{ fontWeight: 'bold', mb: { xs: 2, sm: 3 }, fontSize: { xs: 26, sm: 32 } }}
            >
              Файлообменник
            </Typography>

            {!showUploadSuccess ? (
              <>
                <Box {...getRootProps()} sx={{
                  border: '2px dashed',
                  borderColor: isDragActive ? 'primary.main' : 'grey.300',
                  borderRadius: 4,
                  p: { xs: 2, sm: 4 },
                  textAlign: 'center',
                  cursor: 'pointer',
                  mb: { xs: 1, sm: 2 },
                  maxWidth: '100%',
                  overflow: 'hidden',
                }}>
                  <input {...getInputProps()} />
                  <CloudUploadIcon sx={{ fontSize: { xs: 44, sm: 64 }, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" sx={{ fontSize: { xs: 16, sm: 20 } }}>
                    {isDragActive ? 'Отпустите файл здесь' : 'Перетащите файл сюда или нажмите для выбора'}
                  </Typography>
                </Box>
                {file && (
                  <Typography variant="body1" sx={{ mt: 2, textAlign: 'center' }}>
                    Выбран файл: {file.name} ({(file.size / (1024*1024)).toFixed(2)} МБ)
                  </Typography>
                )}
                <FormControl fullWidth sx={{ mt: 3 }}>
                  <InputLabel id="expire-label">Время хранения</InputLabel>
                  <Select
                    labelId="expire-label"
                    value={expire}
                    label="Время хранения"
                    onChange={(e) => setExpire(e.target.value)}
                  >
                    {EXPIRE_OPTIONS.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  label="Пароль (необязательно)"
                  variant="outlined"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  sx={{ mt: 3 }}
                />
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                  <StyledButton
                    variant="contained"
                    size="large"
                    onClick={handleUpload}
                    disabled={!file || loading}
                    startIcon={loading ? <CircularProgress size={24} /> : <CloudUploadIcon />}
                  >
                    Загрузить файл
                  </StyledButton>
                </Box>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', p: 3 }}>
                <Typography variant="h5" sx={{ mb: 2 }}>
                  Файл успешно загружен!
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold', fontSize: { xs: 18, sm: 24 }, mb: 2, wordBreak: 'break-all' }}>
                  Ваш логин: {fileId}
                  <Button onClick={handleCopyId} size="small" sx={{ ml: 1, minWidth: 0, p: { xs: 1, sm: 0.5 } }}>
                    <ContentCopyIcon fontSize={window.innerWidth < 500 ? 'medium' : 'small'} />
                  </Button>
                </Typography>
                {fileId && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
                    <QRCodeCanvas value={`http://localhost:8000/download/${fileId}`} size={window.innerWidth < 500 ? 120 : 180} />
                    <Typography variant="caption" sx={{ mt: 1, fontSize: { xs: 12, sm: 14 } }}>
                      Отсканируйте для скачивания файла
                    </Typography>
                  </Box>
                )}
                {expiresAt && timeLeft && (
                  <Typography variant="body2" sx={{ mb: 2, color: 'red', fontWeight: 'bold' }}>
                    Файл будет удалён через: {timeLeft}
                  </Typography>
                )}
                <StyledButton variant="outlined" onClick={handleUploadAnother} sx={{ mt: 2 }}>
                  Загрузить ещё файл
                </StyledButton>
                <Typography
                  variant="body1"
                  sx={{ mt: 3, color: 'green', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline', transition: 'color 0.2s', '&:hover': { color: 'primary.main' } }}
                  onClick={handleDownload}
                  tabIndex={0}
                  role="button"
                  aria-label="Скачать файл"
                >
                  Хотите скачать файл? Просто нажмите сюда!
                </Typography>
              </Box>
            )}

            {!showUploadSuccess && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" sx={{ textAlign: 'center', mb: 2 }}>
                  Скачать файл
                </Typography>
                <TextField
                  fullWidth
                  label="Логин файла"
                  variant="outlined"
                  value={fileId}
                  onChange={(e) => setFileId(e.target.value)}
                  sx={{ mb: 2 }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <StyledButton
                    variant="outlined"
                    size="large"
                    onClick={handleDownload}
                    disabled={!fileId || loading}
                    startIcon={<DownloadIcon />}
                  >
                    Скачать
                  </StyledButton>
                </Box>
              </Box>
            )}
          </StyledPaper>
        </Container>
      </AnimatedBackground>
      <Box sx={{ textAlign: 'center', color: 'grey.600', fontSize: 16, mt: 2, mb: 1 }}>
        Создатель — EverestAlpine
      </Box>
    </>
  );
}

export default App;
