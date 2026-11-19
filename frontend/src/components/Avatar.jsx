import { useState } from "react";

const COLORS = [
  "bg-primary text-primary-content",
  "bg-secondary text-secondary-content",
  "bg-accent text-accent-content",
  "bg-info text-info-content",
  "bg-success text-success-content",
];

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < (name?.length || 0); i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const Avatar = ({ src, name, className = "" }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center rounded-full font-bold select-none ${colorFor(name)} ${className}`}>
        {initials(name)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name || "avatar"}
      className={`rounded-full object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
};

export default Avatar;
