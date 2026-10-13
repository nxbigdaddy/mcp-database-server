import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import Dashboard from './pages/Dashboard';
import Connections from './pages/Connections';
import Query from './pages/Query';
import Data from './pages/Data';
import Schema from './pages/Schema';
import Audit from './pages/Audit';
import Settings from './pages/Settings';

const { Content } = Layout;

function App() {
  return (
    <BrowserRouter>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Sider width={200} theme="dark">
          <div className="h-full flex flex-col">
            <div className="h-16 flex items-center justify-center text-white text-lg font-bold">
              MCP Database Server
            </div>
            <nav className="flex-1 p-2">
              <ul className="space-y-1">
                <li>
                  <a href="/" className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded">
                    📊 仪表盘
                  </a>
                </li>
                <li>
                  <a href="/connections" className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded">
                    🔗 连接管理
                  </a>
                </li>
                <li>
                  <a href="/query" className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded">
                    💻 SQL 工作台
                  </a>
                </li>
                <li>
                  <a href="/data" className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded">
                    📁 数据浏览
                  </a>
                </li>
                <li>
                  <a href="/schema" className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded">
                    📋 表结构
                  </a>
                </li>
                <li>
                  <a href="/audit" className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded">
                    📝 审计日志
                  </a>
                </li>
                <li>
                  <a href="/settings" className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded">
                    ⚙️ 系统设置
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </Layout.Sider>
        <Layout>
          <Content className="m-4">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/connections" element={<Connections />} />
              <Route path="/query" element={<Query />} />
              <Route path="/data" element={<Data />} />
              <Route path="/schema" element={<Schema />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
