import { WorkspaceShell } from "./ui/WorkspaceShell";
import { useAppShellController } from "./ui/useAppShellController";

export default function App() {
  const shell = useAppShellController();
  return <WorkspaceShell {...shell} />;
}
