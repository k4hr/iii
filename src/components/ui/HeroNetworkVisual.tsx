export function HeroNetworkVisual() {
  const nodes = [
    [310, 64], [416, 112], [476, 220], [426, 334], [306, 392], [186, 338],
    [132, 222], [188, 108], [306, 132], [374, 220], [306, 306], [236, 220],
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
    [0, 8], [1, 8], [2, 9], [3, 10], [4, 10], [5, 10], [6, 11], [7, 8],
    [8, 9], [9, 10], [10, 11], [11, 8], [8, 10], [9, 11], [0, 4], [2, 6],
  ];

  return (
    <div className="hero-network" aria-hidden="true">
      <div className="hero-network__orbit hero-network__orbit--one" />
      <div className="hero-network__orbit hero-network__orbit--two" />
      <svg viewBox="0 0 610 460" fill="none">
        <defs>
          <radialGradient id="node-core">
            <stop offset="0" stopColor="#d8fffb" />
            <stop offset=".3" stopColor="#45f5e3" />
            <stop offset="1" stopColor="#087d86" stopOpacity=".2" />
          </radialGradient>
          <linearGradient id="edge-line" x1="130" y1="80" x2="480" y2="380">
            <stop stopColor="#8bfff2" stopOpacity=".18" />
            <stop offset=".5" stopColor="#31e8dc" stopOpacity=".8" />
            <stop offset="1" stopColor="#0b7f8c" stopOpacity=".18" />
          </linearGradient>
        </defs>
        <g className="hero-network__edges" stroke="url(#edge-line)" strokeWidth="1.2">
          {edges.map(([from, to], index) => (
            <line key={index} x1={nodes[from][0]} y1={nodes[from][1]} x2={nodes[to][0]} y2={nodes[to][1]} />
          ))}
        </g>
        <g className="hero-network__nodes">
          {nodes.map(([cx, cy], index) => (
            <g key={index} style={{animationDelay: `${index * -0.19}s`}}>
              <circle cx={cx} cy={cy} r={index > 7 ? 10 : 6} fill="url(#node-core)" opacity=".24" />
              <circle cx={cx} cy={cy} r={index > 7 ? 3.5 : 2.5} fill="#9ffff4" />
            </g>
          ))}
        </g>
        <ellipse cx="306" cy="220" rx="176" ry="174" stroke="#34ded3" strokeOpacity=".24" />
        <ellipse cx="306" cy="220" rx="176" ry="64" stroke="#34ded3" strokeOpacity=".18" />
        <ellipse cx="306" cy="220" rx="64" ry="174" stroke="#34ded3" strokeOpacity=".16" />
      </svg>
      <div className="hero-network__label hero-network__label--one">CONDITION MAP</div>
      <div className="hero-network__label hero-network__label--two">MODEL 01</div>
      <div className="hero-network__label hero-network__label--three">SIGNAL ACTIVE</div>
    </div>
  );
}
