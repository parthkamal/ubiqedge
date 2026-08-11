import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AppLayout from '@cloudscape-design/components/app-layout';
import SideNavigation from '@cloudscape-design/components/side-navigation';
import TopNavigation from '@cloudscape-design/components/top-navigation';
import { selectRoleType } from '../store/authSlice';
import { navItemsForRole, homePathByRole } from '../routes/routeConfig';
import { useAuth } from '../hooks/useAuth';
// dark-background variant — TopNavigation's default background is dark
// navy, and the light-background wordmark's "EDGE" text (near-black) would
// be unreadable against it. This variant renders "EDGE" as a light outline
// instead, matching the source site's own footer/dark-surface logo.
import logo from '../assets/ubiqedge-logo-nav.png';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const roleType = useSelector(selectRoleType);
  const { logout } = useAuth();
  const [navigationOpen, setNavigationOpen] = useState(true);

  const navItems = navItemsForRole(roleType);

  function handleFollow(event) {
    event.preventDefault();
    navigate(event.detail.href);
  }

  function handleUtilityClick(event) {
    if (event.detail.id === 'sign-out') logout();
    else if (event.detail.id === 'view-profile') navigate('/profile');
  }

  return (
    <>
      <div id="top-navigation" style={{ position: 'sticky', top: 0, zIndex: 1002 }}>
        <TopNavigation
          identity={{
            href: homePathByRole[roleType],
            logo: { src: logo, alt: 'UbiqEdge' },
            onFollow: handleFollow,
          }}
          utilities={[
            {
              type: 'menu-dropdown',
              text: roleType,
              iconName: 'user-profile',
              onItemClick: handleUtilityClick,
              items: [
                { id: 'view-profile', text: 'View profile' },
                { id: 'sign-out', text: 'Sign out' },
              ],
            },
          ]}
        />
      </div>
      <AppLayout
        headerSelector="#top-navigation"
        toolsHide
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        navigation={
          <SideNavigation
            activeHref={location.pathname}
            items={navItems}
            onFollow={handleFollow}
          />
        }
        content={children}
      />
    </>
  );
}
