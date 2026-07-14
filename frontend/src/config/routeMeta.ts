export type RouteMeta = {
  path: string;
  group?: string;
  label: string;
};

/** Longer paths first for prefix matching. */
export const ROUTE_META: RouteMeta[] = [
  { path: '/offers/templates', group: '人才中心', label: 'Offer模板' },
  { path: '/settings/profile', group: '系统',    label: '个人设置' },
  { path: '/settings/system',  group: '系统',    label: '系统设置' },
  { path: '/settings/users',   group: '系统',    label: '用户管理' },
  { path: '/question-banks',   group: '人才中心', label: '题库管理' },
  { path: '/coding-tests',     group: '招聘管理', label: '笔试管理' },
  { path: '/interviews',       group: '招聘管理', label: '面试管理' },
  { path: '/positions',        group: '招聘管理', label: '岗位管理' },
  { path: '/workflows',        group: '自动化',   label: '工作流' },
  { path: '/resumes',          group: '招聘管理', label: '简历管理' },
  { path: '/offers',           group: '人才中心', label: 'Offer管理' },
  { path: '/dashboard',        label: '看板' },
];

export function resolveRouteMeta(pathname: string): RouteMeta {
  if (pathname.startsWith('/workflows/') && pathname !== '/workflows') {
    return { path: pathname, group: '自动化', label: '工作流编辑' };
  }

  const match = ROUTE_META.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`)
  );

  return match || { path: pathname, label: '智能招聘系统' };
}
