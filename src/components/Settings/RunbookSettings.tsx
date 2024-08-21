import { Settings } from "@/state/settings";
import { Input, Spinner } from "@nextui-org/react";

import { useEffect, useState } from "react";

const RunbookSettings = () => {
  const [prometheusUrl, setPrometheusUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let prom_url = await Settings.runbookPrometheusUrl();
      setPrometheusUrl(prom_url || "http://localhost:9090");
    })();
  }, []);

  if (!prometheusUrl) {
    return <Spinner />;
  }

  return (
    <div>
      <Input
        label="Prometheus server URL"
        placeholder="http://localhost:9090"
        description="URL of the Prometheus server to use for querying metrics. Can be overridden per-block"
        value={prometheusUrl}
        onChange={async (e) => {
          setPrometheusUrl(e.target.value);
          await Settings.runbookPrometheusUrl(e.target.value);
        }}
      />
    </div>
  );
};

export default RunbookSettings;
