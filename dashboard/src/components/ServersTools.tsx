import React, { useState, useEffect } from "react";
import {
  Server,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  FileCode,
  Search,
  RefreshCw,
  X
} from "lucide-react";
import type { ServerRecord, ToolItem } from "../types.js";
import { api } from "../services/api.js";

export const ServersTools: React.FC = () => {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterQuarantined, setFilterQuarantined] = useState<"all" | "active" | "quarantined">("all");
  const [filterHashStatus, setFilterHashStatus] = useState<"all" | "verified" | "mismatched">("all");
  const [inspectTool, setInspectTool] = useState<ToolItem | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    const [srvData, toolData] = await Promise.all([api.getServers(), api.getTools()]);
    setServers(srvData);
    setTools(toolData);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleQuarantine = async (tool: ToolItem) => {
    try {
      setIsUpdating(tool.id);
      const newStatus = !tool.quarantined;
      await api.toggleQuarantine(tool.id, newStatus);
      setBannerMessage(
        newStatus
          ? `Tool '${tool.name}' has been QUARANTINED. It is now stripped from vector search and proxy forwarding.`
          : `Tool '${tool.name}' released from quarantine.`
      );
      await fetchData();
      setTimeout(() => setBannerMessage(null), 5000);
    } catch (err) {
      setBannerMessage(`Failed to update quarantine: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleApproveHash = async (tool: ToolItem) => {
    try {
      setIsUpdating(tool.id);
      await api.approveToolSchemaHash(tool.id);
      setBannerMessage(`Approved new schema hash for '${tool.name}'. Hash verified and tool un-quarantined.`);
      await fetchData();
      setTimeout(() => setBannerMessage(null), 5000);
    } catch (err) {
      setBannerMessage(`Failed to approve hash: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUpdating(null);
    }
  };

  const filteredTools = tools.filter((tool) => {
    if (filterQuarantined === "active" && tool.quarantined) return false;
    if (filterQuarantined === "quarantined" && !tool.quarantined) return false;
    if (filterHashStatus !== "all" && tool.hashStatus !== filterHashStatus) return false;

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.serverName.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Downstream Servers Health Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            Downstream MCP Servers ({servers.length} Registered)
          </h3>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-900 border border-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {servers.map((srv) => (
            <div
              key={srv.id}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-base">
                      {srv.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                      {srv.transport}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-400 mt-1 truncate" title={srv.endpoint}>
                    {srv.endpoint}
                  </p>
                </div>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {srv.status}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Tools: {srv.toolCount}</span>
                <span>Latency: {srv.latencyMs}ms</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {bannerMessage && (
        <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 text-xs flex items-center justify-between animate-fadeIn">
          <span>{bannerMessage}</span>
          <button onClick={() => setBannerMessage(null)} className="text-cyan-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tools Table with Hash Integrity & Quarantine Controls */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        {/* Table Filter Controls */}
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tools, schemas, or descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-slate-400">Quarantine:</span>
              <select
                value={filterQuarantined}
                onChange={(e) => setFilterQuarantined(e.target.value as any)}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All</option>
                <option value="active" className="bg-slate-900">Active Only</option>
                <option value="quarantined" className="bg-slate-900">Quarantined Only</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-slate-400">Hash Status:</span>
              <select
                value={filterHashStatus}
                onChange={(e) => setFilterHashStatus(e.target.value as any)}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Hashes</option>
                <option value="verified" className="bg-slate-900">Verified</option>
                <option value="mismatched" className="bg-slate-900">Mismatched / Rug Pull</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tools List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Tool Name & Server</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Schema Hash Integrity</th>
                <th className="py-3 px-4 text-center">Quarantine Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-sans">
              {filteredTools.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No tools match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredTools.map((tool) => {
                  const isUpdatingThis = isUpdating === tool.id;
                  const isMismatched = tool.hashStatus === "mismatched";

                  return (
                    <tr
                      key={tool.id}
                      className={`hover:bg-slate-850/50 transition-colors ${
                        tool.quarantined ? "bg-rose-950/10" : ""
                      }`}
                    >
                      {/* Name & Server */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-sm">
                            {tool.name}
                          </span>
                          {tool.isCore && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-mono">
                              CORE
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                          server: <span className="text-slate-300">{tool.serverName}</span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 max-w-xs text-slate-300 truncate" title={tool.description}>
                        {tool.description}
                      </td>

                      {/* Hash Status */}
                      <td className="py-3 px-4">
                        {tool.hashStatus === "verified" ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Verified Hash
                          </div>
                        ) : (
                          <div className="inline-flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-mono font-bold animate-pulse">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              RUG PULL: Hash Mismatch
                            </span>
                            <span className="text-[10px] text-rose-400 font-mono">
                              Schema mutated post-approval
                            </span>
                          </div>
                        )}
                        <div className="font-mono text-[10px] text-slate-500 mt-1 truncate max-w-[180px]" title={`Current: ${tool.schemaHash}`}>
                          {tool.schemaHash.slice(0, 16)}...
                        </div>
                      </td>

                      {/* Quarantine Status Toggle */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleQuarantine(tool)}
                          disabled={isUpdatingThis}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            tool.quarantined
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30 shadow-md shadow-rose-950"
                              : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:border-slate-600"
                          }`}
                        >
                          {tool.quarantined ? (
                            <>
                              <Lock className="w-3.5 h-3.5 text-rose-400" /> Quarantined
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3.5 h-3.5 text-emerald-400" /> Active
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isMismatched && (
                            <button
                              onClick={() => handleApproveHash(tool)}
                              disabled={isUpdatingThis}
                              className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-[11px] font-medium"
                              title="Accept and approve this updated schema hash"
                            >
                              Approve Hash
                            </button>
                          )}
                          <button
                            onClick={() => setInspectTool(tool)}
                            className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
                            title="Inspect schema details"
                          >
                            <FileCode className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schema Inspector Modal */}
      {inspectTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setInspectTool(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-mono">{inspectTool.name}</h3>
                <p className="text-xs text-slate-400">Server: {inspectTool.serverName} • RFC 8785 Canonical Schema</p>
              </div>
            </div>

            <div className="space-y-4 my-4">
              <div>
                <span className="text-xs text-slate-400 font-mono block mb-1">Description</span>
                <p className="text-sm text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  {inspectTool.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block mb-0.5">Computed Schema Hash</span>
                  <span className="text-slate-300 break-all">{inspectTool.schemaHash}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block mb-0.5">Approved Admin Hash</span>
                  <span className={inspectTool.approvedHash === inspectTool.schemaHash ? "text-emerald-400 break-all" : "text-rose-400 break-all"}>
                    {inspectTool.approvedHash ?? "None (Unapproved)"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400 font-mono block mb-1">JSON Schema Definition</span>
                <pre className="p-3 bg-slate-950 rounded-lg text-xs font-mono text-cyan-300 overflow-x-auto max-h-56 border border-slate-800">
                  {JSON.stringify(inspectTool.inputSchema, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setInspectTool(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
