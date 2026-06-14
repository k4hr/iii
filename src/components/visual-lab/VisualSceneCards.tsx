import {GlassPanel} from '@/components/ui/GlassPanel';

export function VisualSceneCards({scene, labels}: {scene: any; labels: Record<string, string>}) {
  return (
    <GlassPanel className="data-grid grid gap-3 p-3 md:grid-cols-2">
      <SceneCard code="OBJ" title={labels.objects} items={scene.objectsJson} />
      <SceneCard code="VAR" title={labels.variables} items={scene.variablesJson} />
      <SceneCard code="CON" title={labels.constraints} items={scene.constraintsJson} />
      <SceneCard code="MEA" title={labels.measurements} items={scene.measurementsJson} />
    </GlassPanel>
  );
}

function SceneCard({code, title, items}: {code: string; title: string; items: any}) {
  const values = Array.isArray(items) ? items : [];
  return (
    <div className="rounded-2xl border border-cyan-100/[0.09] bg-black/40 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-cyan-50">{title}</h3>
        <span className="font-mono text-[9px] tracking-[.15em] text-cyan-300/35">{code}/{String(values.length).padStart(2, '0')}</span>
      </div>
      <div className="mt-4 space-y-2">
        {values.map((item: any, index: number) => (
          <div key={index} className="flex items-start gap-3 border-l border-cyan-200/15 bg-cyan-200/[0.025] px-3 py-2.5 text-xs leading-5 text-[#91adaf]">
            <span className="font-mono text-[9px] text-cyan-300/35">{String(index + 1).padStart(2, '0')}</span>
            <span>{typeof item === 'object' ? `${item.label || item.id} — ${item.type || ''}` : String(item)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
