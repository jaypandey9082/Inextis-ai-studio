import { ScreenAdapter } from "@/components/screen-adapter";
import { PageHeader } from "@/components/ui";

export default function ScreensPage() {
  return (
    <>
      <PageHeader
        eyebrow="Problem 3 · One creative, every screen"
        title="Screen Adapter"
        subtitle="One master design becomes correct artwork for all 11 screens on the NOVA booth: LED ring, ribbons, walls, totems and touch tables. Change the sponsor or date once and every version updates."
      />
      <ScreenAdapter />
    </>
  );
}
