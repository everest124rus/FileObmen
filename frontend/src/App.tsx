import React, { useState, useCallback } from 'react';
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
  keyframes
} from '@mui/material';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import { styled } from '@mui/material/styles';

const API_URL = 'http://localhost:8000';

// Анимация для фона
const gradientAnimation = keyframes`
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
`;

// Стилизованный контейнер для анимированного фона
const AnimatedBackground = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  background: 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)',
  backgroundSize: '400% 400%',
  animation: `${gradientAnimation} 15s ease infinite`,
  padding: theme.spacing(4),
}));

// Стилизованная карточка
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  borderRadius: 16,
  background: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
  transition: 'transform 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-5px)',
  },
}));

// Стилизованная кнопка
const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: 25,
  padding: '12px 30px',
  textTransform: 'none',
  fontSize: '1.1rem',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'scale(1.05)',
    boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
  },
}));

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [fileId, setFileId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
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

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    if (password) {
      formData.append('password', password);
    }

    try {
      const response = await axios.post(`${API_URL}/upload`, formData);
      setFileId(response.data.file_id);
      setMessage(`Файл успешно загружен! ID: ${response.data.file_id}`);
      setFile(null);
      setPassword('');
    } catch (err) {
      setError('Ошибка при загрузке файла');
    } finally {
      setLoading(false);
    }
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

  return (
    <AnimatedBackground>
      <Container maxWidth="lg">
        <StyledPaper>
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            align="center"
            sx={{
              fontWeight: 'bold',
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              backgroundClip: 'text',
              textFillColor: 'transparent',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 4,
              animation: 'fadeIn 1s ease-in',
            }}
          >
            Быстрый обмен файлами
          </Typography>

          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Box
                {...getRootProps()}
                sx={{
                  border: '2px dashed',
                  borderColor: isDragActive ? 'primary.main' : 'grey.300',
                  borderRadius: 4,
                  p: 4,
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'rgba(33, 150, 243, 0.04)',
                    transform: 'scale(1.02)',
                  },
                }}
              >
                <input {...getInputProps()} />
                <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6">
                  {isDragActive
                    ? 'Отпустите файл здесь'
                    : 'Перетащите файл сюда или нажмите для выбора'}
                </Typography>
              </Box>

              {file && (
                <Typography variant="body1" sx={{ mt: 2, textAlign: 'center' }}>
                  Выбран файл: {file.name}
                </Typography>
              )}

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
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ p: 2 }}>
                <Typography variant="h5" gutterBottom sx={{ textAlign: 'center', mb: 3 }}>
                  Скачать файл
                </Typography>
                <TextField
                  fullWidth
                  label="ID файла"
                  variant="outlined"
                  value={fileId}
                  onChange={(e) => setFileId(e.target.value)}
                  sx={{ mb: 3 }}
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
            </Grid>
          </Grid>
        </StyledPaper>
      </Container>

      <Snackbar
        open={!!message}
        autoHideDuration={6000}
        onClose={() => setMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setMessage('')} sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError('')} sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </AnimatedBackground>
  );
}

export default App;
