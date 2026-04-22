import { useState, useEffect } from 'react'
import './App.css'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardMedia from '@mui/material/CardMedia'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import SendIcon from '@mui/icons-material/Send'
import ModeNightIcon from '@mui/icons-material/ModeNight'
import WbSunnyIcon from '@mui/icons-material/WbSunny'

// 历史人物数据
const historicalFigures = [
  {
    id: 1,
    name: '孔子',
    description: '中国古代思想家、教育家，儒家学派创始人',
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ancient%20chinese%20philosopher%20Confucius%20portrait%2C%20traditional%20style%2C%20wise%20expression&image_size=square'
  },
  {
    id: 2,
    name: '莎士比亚',
    description: '英国文艺复兴时期剧作家、诗人',
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=William%20Shakespeare%20portrait%2C%20renaissance%20style%2C%20dramatic%20expression&image_size=square'
  },
  {
    id: 3,
    name: '牛顿',
    description: '英国物理学家、数学家，万有引力定律发现者',
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Isaac%20Newton%20portrait%2C%20enlightenment%20era%2C%20scientist%20working%20on%20formulas&image_size=square'
  },
  {
    id: 4,
    name: '达芬奇',
    description: '意大利文艺复兴时期艺术家、发明家',
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Leonardo%20da%20Vinci%20portrait%2C%20renaissance%20style%2C%20artist%20and%20inventor&image_size=square'
  }
]

function App() {
  const [darkMode, setDarkMode] = useState(false)
  const [selectedFigure, setSelectedFigure] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')

  // 切换主题
  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
  }

  // 创建主题
  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
    },
  })

  // 选择历史人物
  const handleSelectFigure = (figure) => {
    setSelectedFigure(figure)
    setMessages([{
      role: 'assistant',
      content: `你好！我是${figure.name}。很高兴能和你交流。`
    }])
  }

  // 发送消息
  const handleSendMessage = () => {
    if (inputText.trim() === '') return

    // 添加用户消息
    const newMessages = [...messages, { role: 'user', content: inputText }]
    setMessages(newMessages)
    setInputText('')

    // 模拟AI回复
    setTimeout(() => {
      setMessages([...newMessages, {
        role: 'assistant',
        content: `这是${selectedFigure.name}的回复：${inputText}`
      }])
    }, 1000)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="App">
        {/* 主题切换按钮 */}
        <IconButton 
          onClick={toggleDarkMode}
          style={{ position: 'absolute', top: 16, right: 16 }}
          color="inherit"
        >
          {darkMode ? <WbSunnyIcon /> : <ModeNightIcon />}
        </IconButton>

        <Container maxWidth="lg">
          {!selectedFigure ? (
            // 人物选择界面
            <div className="figure-selection">
              <Typography component="h1" variant="h3" align="center" gutterBottom>
                选择历史人物进行对话
              </Typography>
              <Grid container spacing={4}>
                {historicalFigures.map((figure) => (
                  <Grid item key={figure.id} xs={12} sm={6} md={3}>
                    <Card 
                      sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                      onClick={() => handleSelectFigure(figure)}
                      style={{ cursor: 'pointer' }}
                    >
                      <CardMedia
                        component="img"
                        height="200"
                        image={figure.image}
                        alt={figure.name}
                      />
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Typography gutterBottom variant="h5" component="h2">
                          {figure.name}
                        </Typography>
                        <Typography>
                          {figure.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </div>
          ) : (
            // 对话界面
            <div className="chat-interface">
              <Button 
                variant="outlined" 
                onClick={() => setSelectedFigure(null)}
                style={{ marginBottom: 16 }}
              >
                返回选择
              </Button>
              <Card sx={{ mb: 4 }}>
                <CardMedia
                  component="img"
                  height="200"
                  image={selectedFigure.image}
                  alt={selectedFigure.name}
                />
                <CardContent>
                  <Typography gutterBottom variant="h4" component="h2">
                    {selectedFigure.name}
                  </Typography>
                  <Typography variant="body1">
                    {selectedFigure.description}
                  </Typography>
                </CardContent>
              </Card>
              
              <Box sx={{ 
                border: 1, 
                borderColor: 'divider',
                borderRadius: 2,
                p: 2,
                mb: 2,
                height: 400,
                overflowY: 'auto'
              }}>
                {messages.map((message, index) => (
                  <Box 
                    key={index} 
                    sx={{
                      mb: 1,
                      p: 1.5,
                      borderRadius: 1,
                      backgroundColor: message.role === 'user' ? 'primary.light' : 'grey.200',
                      alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '80%'
                    }}
                  >
                    <Typography variant="body1">{message.content}</Typography>
                  </Box>
                ))}
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="输入你的问题..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <IconButton 
                  color="primary" 
                  onClick={handleSendMessage}
                  sx={{ mt: 1 }}
                >
                  <SendIcon />
                </IconButton>
              </Box>
            </div>
          )}
        </Container>
      </div>
    </ThemeProvider>
  )
}

export default App