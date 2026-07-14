import React, { useMemo, useState } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Tooltip, Badge } from 'antd';
import {
  BarChartOutlined,
  UserOutlined,
  ContactsOutlined,
  CalendarOutlined,
  EditOutlined,
  BookOutlined,
  LogoutOutlined,
  BellOutlined,
  SettingOutlined,
  TrophyOutlined,
  DeploymentUnitOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SnippetsOutlined,
  SolutionOutlined,
  UsergroupAddOutlined,
  CaretDownOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { MenuProps } from 'antd';
import PageBreadcrumb from '../PageBreadcrumb';

const { Header, Sider, Content } = Layout;

type NavItem = { key: string; icon: React.ReactNode; label: string; roles?: string[] };
type NavGroup = { title?: string; items: NavItem[] };

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const role = (user as any)?.role?.value ?? (user as any)?.role;

  const navGroups: NavGroup[] = useMemo(() => [
    {
      items: [
        { key: '/dashboard', icon: <BarChartOutlined />, label: '看板' },
      ],
    },
    {
      title: '招聘管理',
      items: [
        { key: '/positions',    icon: <SolutionOutlined />,  label: '岗位管理', roles: ['admin', 'hr'] },
        { key: '/resumes',      icon: <ContactsOutlined />,  label: '简历管理' },
        { key: '/interviews',   icon: <CalendarOutlined />,  label: '面试管理' },
        { key: '/coding-tests', icon: <EditOutlined />,      label: '笔试管理', roles: ['admin', 'hr'] },
      ],
    },
    {
      title: '人才中心',
      items: [
        { key: '/question-banks',   icon: <BookOutlined />,          label: '题库管理',  roles: ['admin', 'hr'] },
        { key: '/offers',           icon: <TrophyOutlined />,        label: 'Offer管理', roles: ['admin', 'hr'] },
        { key: '/offers/templates', icon: <SnippetsOutlined />,      label: 'Offer模板', roles: ['admin', 'hr'] },
      ],
    },
    {
      title: '自动化',
      items: [
        { key: '/workflows', icon: <DeploymentUnitOutlined />, label: '工作流' },
      ],
    },
    {
      title: '系统',
      items: [
        { key: '/settings/users', icon: <UsergroupAddOutlined />, label: '用户管理', roles: ['admin'] },
      ],
    },
  ], []);

  const flatItems = navGroups.flatMap((g) => g.items);

  const menuItems: MenuProps['items'] = navGroups
    .map((group) => {
      const visible = group.items.filter((item) =>
        !item.roles || item.roles.includes(role)
      );
      if (visible.length === 0) return null;
      const children = visible.map(({ key, icon, label }) => ({ key, icon, label }));
      if (!group.title) return children;
      return [{ type: 'group' as const, label: collapsed ? null : group.title, children }];
    })
    .filter(Boolean)
    .flat() as MenuProps['items'];

  const selectedKey = useMemo(() => {
    return flatItems
      .map((i) => i.key)
      .filter((key) => location.pathname === key || location.pathname.startsWith(`${key}/`))
      .sort((a, b) => b.length - a.length)[0] || location.pathname;
  }, [flatItems, location.pathname]);

  const displayName = user?.full_name || user?.email || '用户';
  const initials = (displayName.trim()[0] || 'U').toUpperCase();
  const roleLabel = role === 'admin' ? '管理员' : role === 'hr' ? 'HR' : role === 'interviewer' ? '面试官' : '用户';

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', label: '个人中心', icon: <UserOutlined />, onClick: () => navigate('/settings/profile') },
    ...(role === 'admin' ? [{ key: 'settings', label: '系统设置', icon: <SettingOutlined />, onClick: () => navigate('/settings/system') }] : []),
    { type: 'divider' as const },
    { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: () => { logout(); navigate('/login'); } },
  ];

  return (
    <Layout className="app-shell">
      {/* ── Top header ── */}
      <Header className="app-header">
        {/* Brand */}
        <div className="app-header-brand">
          <span className="brand-mark" aria-hidden="true">HR</span>
          <span className="app-header-brand-name">AI-HR 智能招聘系统</span>
        </div>

        {/* Right controls */}
        <div className="app-header-right">
          <Tooltip title="通知" placement="bottom">
            <button type="button" className="app-icon-btn">
              <Badge dot offset={[-3, 3]}>
                <BellOutlined style={{ fontSize: 16 }} />
              </Badge>
            </button>
          </Tooltip>

          <div className="app-header-divider" />

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
            <button type="button" className="app-user-btn">
              <Avatar size={28} className="app-user-avatar">{initials}</Avatar>
              <span className="app-user-info">
                <span className="app-user-name">{displayName}</span>
                <span className="app-user-role">{roleLabel}</span>
              </span>
              <CaretDownOutlined className="app-user-caret" />
            </button>
          </Dropdown>
        </div>
      </Header>

      {/* ── Body ── */}
      <Layout>
        {/* ── Sidebar ── */}
        <Sider
          collapsible
          collapsed={collapsed}
          trigger={null}
          width={220}
          collapsedWidth={64}
          theme="light"
          className="app-sider"
        >
          <div className="app-sider-scroll">
            <Menu
              mode="inline"
              theme="light"
              selectedKeys={[selectedKey]}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
              className="app-sider-menu"
              inlineIndent={14}
            />
          </div>

          <div className="app-sider-footer">
            <Tooltip title={collapsed ? '展开' : '收起'} placement="right">
              <Button
                type="text"
                className="app-sider-toggle"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed((v) => !v)}
              />
            </Tooltip>
          </div>
        </Sider>

        {/* ── Content ── */}
        <Content className="app-content">
          <div className="page-container">
            <PageBreadcrumb pathname={location.pathname} />
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
