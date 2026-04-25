import React from "react";

export default function Panel({ title, icon, children, delay = 0 }) {
  return (
    <div
      className="card"
      style={{
        animationDelay: `${delay}s`,
      }}
    >
      {(title || icon) && (
        <div className="card-header">
          {icon && (
            <span className="material-symbols-rounded card-header-icon">
              {icon}
            </span>
          )}
          {title && <h3 className="card-header-title">{title}</h3>}
        </div>
      )}
      {children}
    </div>
  );
}