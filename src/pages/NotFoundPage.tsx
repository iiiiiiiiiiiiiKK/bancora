import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { SearchIcon } from '../components/Icons';

export function NotFoundPage() {
  const { lang } = useApp();
  return (
    <div className="shell" style={{ padding: '80px 0' }}>
      <div className="empty">
        <div className="empty__icon">
          <SearchIcon />
        </div>
        <h3>{lang === 'zh' ? '页面不存在' : 'This page does not exist'}</h3>
        <p>{lang === 'zh' ? '地址可能已经过期，或者工具已移动。素材库随时可以返回。' : 'The address may be out of date. The Explorer is one click away.'}</p>
        <Link className="btn btn--primary btn--sm" to="/">
          {lang === 'zh' ? '返回素材库' : 'Back to the Explorer'}
        </Link>
      </div>
    </div>
  );
}
