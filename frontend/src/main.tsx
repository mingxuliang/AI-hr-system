import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import router from './router'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#2563EB',
          colorError: '#EF4444',
          borderRadius: 6,
          controlHeight: 36,
          controlHeightLG: 44,
          controlHeightSM: 28,
          fontFamily: "'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei UI', 'Microsoft YaHei', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        components: {
          Button: {
            primaryShadow: '0 1px 2px rgba(37, 99, 235, 0.18)',
            defaultShadow: 'none',
            dangerShadow: '0 1px 2px rgba(239, 68, 68, 0.18)',
            fontWeight: 500,
            contentFontSize: 14,
            contentFontSizeLG: 15,
            contentFontSizeSM: 12,
            paddingInline: 16,
            paddingInlineLG: 22,
            paddingInlineSM: 10,
            borderRadius: 6,
            borderRadiusLG: 6,
            borderRadiusSM: 5,
          },
          Form: {
            labelFontSize: 13,
            labelColor: '#0F172A',
            itemMarginBottom: 20,
          },
          Input: {
            activeBorderColor: '#2563EB',
            hoverBorderColor: '#93C5FD',
            activeShadow: '0 0 0 3px rgba(37, 99, 235, 0.12)',
            borderRadius: 8,
          },
          Select: {
            optionSelectedBg: '#EFF6FF',
            borderRadius: 8,
          },
          Tag: {
            defaultBg: '#EFF6FF',
            defaultColor: '#2563EB',
          },
        },
      }}
    >
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ConfigProvider>
  </StrictMode>,
)
