import React from 'react';
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function MinimumRoleRoute({ children, level }) {
  const { user } = useAuth();
  const highestLevel = Math.max(0, ...(user?.roles || []).map((role) => role.level || 0));
  const allowed = user?.is_superuser || highestLevel >= level;

  return allowed ? children : <Navigate to="/" replace />;
}

MinimumRoleRoute.propTypes = {
  children: PropTypes.node.isRequired,
  level: PropTypes.number.isRequired,
};
