export function LabBackground() {
  return (
    <div className="lab-background" aria-hidden="true">
      <div className="lab-background__aurora lab-background__aurora--one" />
      <div className="lab-background__aurora lab-background__aurora--two" />
      <div className="lab-background__grid" />
      <div className="lab-background__scan" />
      <svg
        className="lab-background__network"
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <g className="network-paths" stroke="currentColor" strokeWidth="1">
          <path d="M-80 715L152 565L354 634L548 430L751 512L938 306L1182 384L1510 142" />
          <path d="M-20 258L226 352L432 214L650 326L864 184L1080 260L1286 112L1480 192" />
          <path d="M152 565L226 352M354 634L432 214M548 430L650 326M751 512L864 184M938 306L1080 260M1182 384L1286 112" />
          <path d="M354 634L226 352M751 512L650 326M1182 384L1080 260" opacity=".45" />
        </g>
        <g className="network-nodes" fill="currentColor">
          {[
            [152, 565, 4],
            [354, 634, 3],
            [548, 430, 5],
            [751, 512, 3],
            [938, 306, 5],
            [1182, 384, 3],
            [226, 352, 4],
            [432, 214, 3],
            [650, 326, 4],
            [864, 184, 3],
            [1080, 260, 4],
            [1286, 112, 3],
          ].map(([cx, cy, r], index) => (
            <circle key={index} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      </svg>
      <div className="lab-background__vignette" />
    </div>
  );
}
