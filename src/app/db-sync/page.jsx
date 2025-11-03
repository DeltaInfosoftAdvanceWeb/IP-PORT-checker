"use client";
import React, { useState } from "react";
import { Header } from "@/components/Header.jsx";
import {
  Database,
  ArrowRight,
  RefreshCw,
  CheckCircle,
  Server,
  Table,
  ArrowLeftRight,
  LoaderCircle,
  Copy,
  X,
} from "lucide-react";
import { Select, Input, Spin, Checkbox, Button } from "antd";
import toast from "react-hot-toast";

const { Option } = Select;
const { TextArea } = Input;

const dbTypes = [
  { value: "postgresql", label: "PostgreSQL", defaultPort: "5432" },
  { value: "mssql", label: "MSSQL", defaultPort: "1433" },
];

const DBConfigPanel = ({
  title,
  dbType,
  config,
  setConfig,
  onDBTypeChange,
  tables,
  onFetchTables,
  isLoading,
  isSource,
  configMode,
  setConfigMode,
  connectionUrl,
  setConnectionUrl,
  onDisconnect,
  onCopyConfig,
  otherConfig,
  otherConfigMode,
  otherConnectionUrl,
}) => (
  <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-shadow duration-300">
    <div className="bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-100 px-3 sm:px-6 py-3 sm:py-5">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl shadow-lg transition-all duration-300 ${
          tables.length > 0
            ? 'bg-gradient-to-br from-green-500 to-green-600'
            : 'bg-gradient-to-br from-[#1ca5b3] to-[#0e7c87]'
        }`}>
          <Database className="w-5 sm:w-6 h-5 sm:h-6 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900">{title}</h2>
            {tables.length > 0 && (
              <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                <span className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse"></span>
                Connected
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">
            {tables.length > 0 ? `${tables.length} tables available` : 'Configure database connection'}
          </p>
        </div>
      </div>
    </div>

    <div className="p-3 sm:p-6 space-y-3 sm:space-y-5">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Database Type *
        </label>
        <Select
          value={dbType}
          onChange={onDBTypeChange}
          className="w-full"
          size="large"
          placeholder="Select database type"
        >
          {dbTypes.map((db) => (
            <Option key={db.value} value={db.value}>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                {db.label}
              </div>
            </Option>
          ))}
        </Select>
      </div>

      {/* Configuration Mode Toggle */}
      <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-3 sm:p-4 border border-gray-200">
        <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
          <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-[#1ca5b3] rounded-full"></span>
          Configuration Method
        </label>
        <div className="flex gap-2 p-1 bg-white rounded-lg border border-gray-200 shadow-inner">
          <button
            onClick={() => setConfigMode("manual")}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${
              configMode === "manual"
                ? "bg-gradient-to-r from-[#1ca5b3] to-[#0e7c87] text-white shadow-md"
                : "bg-transparent text-gray-600 hover:bg-gray-50"
            }`}
          >
            Manual Config
          </button>
          <button
            onClick={() => setConfigMode("url")}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${
              configMode === "url"
                ? "bg-gradient-to-r from-[#1ca5b3] to-[#0e7c87] text-white shadow-md"
                : "bg-transparent text-gray-600 hover:bg-gray-50"
            }`}
          >
            Connection URL
          </button>
        </div>
      </div>

      {configMode === "url" ? (
        /* URL Mode */
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Connection URL *
          </label>
          <TextArea
            value={connectionUrl}
            onChange={(e) => setConnectionUrl(e.target.value)}
            placeholder={
              dbType === "postgresql"
                ? "postgresql://username:password@host:port/database"
                : "Server=host,port;Database=database;User Id=username;Password=password;Encrypt=true;TrustServerCertificate=true"
            }
            rows={3}
            size="large"
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-2">
            {dbType === "postgresql"
              ? "Example: postgresql://user:pass@localhost:5432/mydb"
              : "Example: Server=localhost,1433;Database=mydb;User Id=sa;Password=pass;Encrypt=true;TrustServerCertificate=true"}
          </p>
        </div>
      ) : (
        /* Manual Mode */
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Host *
              </label>
              <Input
                value={config.host}
                onChange={(e) => setConfig((prev) => ({ ...prev, host: e.target.value }))}
                placeholder="localhost or IP address"
                size="large"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Port *
              </label>
              <Input
                value={config.port}
                onChange={(e) => setConfig((prev) => ({ ...prev, port: e.target.value }))}
                placeholder="Port number"
                size="large"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Database Name *
            </label>
            <Input
              value={config.database}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, database: e.target.value }))
              }
              placeholder="Database name"
              size="large"
            />
            {!isSource && configMode === "manual" && otherConfigMode === "manual" && config.database && otherConfig && (
              config.host === otherConfig.host &&
              config.port === otherConfig.port &&
              config.database === otherConfig.database
            ) && (
              <p className="text-xs text-red-600 mt-1 font-bold">
                ⚠️ Must be different from source database (same host & port)
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Username *
              </label>
              <Input
                value={config.username}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, username: e.target.value }))
                }
                placeholder="Database username"
                size="large"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password *
              </label>
              <Input.Password
                value={config.password}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="Database password"
                size="large"
              />
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2">
        {tables.length > 0 && (
          <Button
            danger
            onClick={onDisconnect}
            className="!rounded-lg !font-semibold"
            icon={<X className="w-4 h-4" />}
          >
            Disconnect
          </Button>
        )}
        <Button
          type="primary"
          onClick={onFetchTables}
          disabled={isLoading}
          loading={isLoading}
          className="flex-1 !bg-gradient-to-r !from-[#1ca5b3] !via-[#1398a5] !to-[#0e7c87] hover:!from-[#0e7c87] hover:!to-[#1ca5b3] !text-white !rounded-lg !font-semibold !shadow-lg hover:!shadow-xl transition-all duration-300"
          icon={!isLoading && <Server className="w-4 h-4" />}
        >
          {isLoading ? "Connecting..." : tables.length > 0 ? "Reconnect" : "Connect & Fetch Tables"}
        </Button>
        {!isSource && onCopyConfig && (
          <Button
            onClick={onCopyConfig}
            className="!rounded-lg !font-semibold"
            icon={<Copy className="w-4 h-4" />}
            title="Copy from Source Database"
          >
            Copy Config
          </Button>
        )}
      </div>

      {tables.length > 0 && (
        <div className="mt-5 p-5 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-2 border-green-200 rounded-2xl shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-600 p-2 rounded-lg">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-green-900 text-lg">
                {tables.length} Table{tables.length !== 1 ? 's' : ''} Found
              </span>
              <p className="text-xs text-green-700">Successfully connected to database</p>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-green-300 scrollbar-track-green-100">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {tables.map((table, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-white border border-green-200 px-3 py-2 rounded-lg hover:shadow-md transition-shadow"
                >
                  <Table className="w-4 h-4 text-green-600" />
                  <span className="font-mono text-gray-800 font-medium">{table}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);

const DBSyncTool = () => {
  const [sourceDB, setSourceDB] = useState("");
  const [targetDB, setTargetDB] = useState("");
  const [sourceConfigMode, setSourceConfigMode] = useState("manual"); // "manual" or "url"
  const [targetConfigMode, setTargetConfigMode] = useState("manual"); // "manual" or "url"
  const [sourceConnectionUrl, setSourceConnectionUrl] = useState("");
  const [targetConnectionUrl, setTargetConnectionUrl] = useState("");
  const [sourceConfig, setSourceConfig] = useState({
    host: "",
    port: "",
    database: "",
    username: "",
    password: "",
  });
  const [targetConfig, setTargetConfig] = useState({
    host: "",
    port: "",
    database: "",
    username: "",
    password: "",
  });
  const [sourceTables, setSourceTables] = useState([]);
  const [targetTables, setTargetTables] = useState([]);
  const [selectedTables, setSelectedTables] = useState([]);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [isLoadingTarget, setIsLoadingTarget] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState([]);
  const [showNewTables, setShowNewTables] = useState(true);
  const [showExistingTables, setShowExistingTables] = useState(true);
  const [targetFetched, setTargetFetched] = useState(false);
  const [syncStrategy, setSyncStrategy] = useState("replace"); // "replace" or "merge"

  const handleSourceDBChange = (value) => {
    setSourceDB(value);
    const db = dbTypes.find((d) => d.value === value);
    setSourceConfig({ ...sourceConfig, port: db?.defaultPort || "" });
    setSourceTables([]);
  };

  const handleTargetDBChange = (value) => {
    setTargetDB(value);
    const db = dbTypes.find((d) => d.value === value);
    setTargetConfig({ ...targetConfig, port: db?.defaultPort || "" });
    setTargetTables([]);
    setTargetFetched(false);
  };

  const handleDisconnectSource = () => {
    setSourceTables([]);
    setSelectedTables([]);
    setSyncProgress([]);
    toast.success("Disconnected from source database");
  };

  const handleDisconnectTarget = () => {
    setTargetTables([]);
    setTargetFetched(false);
    setSelectedTables([]);
    setSyncProgress([]);
    toast.success("Disconnected from target database");
  };

  const handleCopyToTarget = () => {
    if (sourceConfigMode === "url") {
      setTargetConfigMode("url");
      // Copy URL but don't copy database name from URL
      const urlWithoutDb = sourceConnectionUrl.replace(/\/[^\/]+$/, '');
      setTargetConnectionUrl(urlWithoutDb);
    } else {
      setTargetConfigMode("manual");
      // Copy all config except database name
      setTargetConfig({ 
        host: sourceConfig.host,
        port: sourceConfig.port,
        username: sourceConfig.username,
        password: sourceConfig.password,
        database: "" // Don't copy database name
      });
    }
    setTargetDB(sourceDB);
    toast.success("Configuration copied (database name excluded)");
  };

  const handleFetchSourceTables = async () => {
    if (!sourceDB) {
      toast.error("Please select a database type");
      return;
    }

    if (sourceConfigMode === "url" && !sourceConnectionUrl) {
      toast.error("Please enter a connection URL");
      return;
    }

    if (sourceConfigMode === "manual" && (!sourceConfig.host || !sourceConfig.database)) {
      toast.error("Please fill all required source DB configuration fields");
      return;
    }

    setIsLoadingSource(true);
    try {
      const response = await fetch("/api/db-sync/fetch-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dbType: sourceDB,
          config: sourceConfigMode === "url" ? null : sourceConfig,
          connectionUrl: sourceConfigMode === "url" ? sourceConnectionUrl : null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSourceTables(data.tables);
        toast.success(`Fetched ${data.tables.length} tables from source`);
      } else {
        toast.error(data.message || "Failed to fetch source tables");
      }
    } catch (error) {
      console.error("Error fetching source tables:", error);
      toast.error("Error connecting to source database");
    } finally {
      setIsLoadingSource(false);
    }
  };

  const handleFetchTargetTables = async () => {
    if (!targetDB) {
      toast.error("Please select a database type");
      return;
    }

    if (targetConfigMode === "url" && !targetConnectionUrl) {
      toast.error("Please enter a connection URL");
      return;
    }

    if (targetConfigMode === "manual" && (!targetConfig.host || !targetConfig.database)) {
      toast.error("Please fill all required target DB configuration fields");
      return;
    }

    // Check if trying to connect to the same database
    if (sourceDB === targetDB && sourceTables.length > 0) {
      if (sourceConfigMode === "url" && targetConfigMode === "url") {
        if (sourceConnectionUrl === targetConnectionUrl) {
          toast.error("Target database cannot be the same as source database!");
          return;
        }
      } else if (sourceConfigMode === "manual" && targetConfigMode === "manual") {
        if (
          sourceConfig.host === targetConfig.host &&
          sourceConfig.port === targetConfig.port &&
          sourceConfig.database === targetConfig.database
        ) {
          toast.error("Target database cannot be the same as source database!");
          return;
        }
      }
    }

    setIsLoadingTarget(true);
    try {
      const response = await fetch("/api/db-sync/fetch-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dbType: targetDB,
          config: targetConfigMode === "url" ? null : targetConfig,
          connectionUrl: targetConfigMode === "url" ? targetConnectionUrl : null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTargetTables(data.tables);
        setTargetFetched(true);

        // Auto-select existing tables (tables that exist in both source and target)
        if (sourceTables.length > 0) {
          const existingTables = sourceTables.filter(table => data.tables.includes(table));
          if (existingTables.length > 0) {
            setSelectedTables(existingTables);
            toast.success(`Fetched ${data.tables.length} tables from target. ${existingTables.length} existing tables auto-selected.`);
          } else {
            toast.success(`Fetched ${data.tables.length} tables from target`);
          }
        } else {
          toast.success(`Fetched ${data.tables.length} tables from target`);
        }
      } else {
        toast.error(data.message || "Failed to fetch target tables");
      }
    } catch (error) {
      console.error("Error fetching target tables:", error);
      toast.error("Error connecting to target database");
    } finally {
      setIsLoadingTarget(false);
    }
  };

  const handleSync = async () => {
    if (selectedTables.length === 0) {
      toast.error("Please select at least one table to sync");
      return;
    }

    // Check if source and target are the same database
    const isSameDatabase = () => {
      if (sourceDB !== targetDB) return false;
      
      if (sourceConfigMode === "url" && targetConfigMode === "url") {
        return sourceConnectionUrl === targetConnectionUrl;
      } else if (sourceConfigMode === "manual" && targetConfigMode === "manual") {
        return (
          sourceConfig.host === targetConfig.host &&
          sourceConfig.port === targetConfig.port &&
          sourceConfig.database === targetConfig.database
        );
      }
      return false;
    };

    if (isSameDatabase()) {
      toast.error("Cannot sync to the same database! Source and target must be different.");
      return;
    }

    setIsSyncing(true);
    setSyncProgress([]);

    try {
      const response = await fetch("/api/db-sync/sync-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceDB,
          targetDB,
          sourceConfig: sourceConfigMode === "url" ? null : sourceConfig,
          targetConfig: targetConfigMode === "url" ? null : targetConfig,
          sourceConnectionUrl: sourceConfigMode === "url" ? sourceConnectionUrl : null,
          targetConnectionUrl: targetConfigMode === "url" ? targetConnectionUrl : null,
          tables: selectedTables,
          syncStrategy: syncStrategy,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSyncProgress(data.results);
        
        // Count successes and failures
        const successCount = data.results.filter(r => r.success).length;
        const failureCount = data.results.filter(r => !r.success).length;
        
        if (failureCount === 0) {
          toast.success(`Successfully synced ${successCount} table${successCount !== 1 ? 's' : ''}!`);
        } else if (successCount === 0) {
          toast.error(`Failed to sync all ${failureCount} table${failureCount !== 1 ? 's' : ''}`);
        } else {
          toast.warning(`Synced ${successCount} table${successCount !== 1 ? 's' : ''}, but ${failureCount} failed`);
        }
        
        // Show individual error toasts for failed tables
        data.results.filter(r => !r.success).forEach(result => {
          toast.error(`${result.table}: ${result.message}`, { duration: 5000 });
        });
      } else {
        toast.error(data.message || "Synchronization failed");
      }
    } catch (error) {
      console.error("Error syncing data:", error);
      toast.error("Error during synchronization");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {isSyncing && (
        <div className="fixed inset-0 flex justify-center items-center bg-black/30 backdrop-blur-md z-50">
          <div className="bg-white rounded-3xl p-10 shadow-2xl max-w-md w-full mx-4 border border-gray-200">
            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                <div className="absolute inset-0 bg-[#1ca5b3]/20 rounded-full animate-ping"></div>
                <Spin
                  size="large"
                  indicator={
                    <LoaderCircle className="animate-spin w-16 h-16" color="#1ca5b3" />
                  }
                />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">
                Syncing Data...
              </h3>
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                Please wait while we synchronize your database tables and data. This may take a few moments.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-2 sm:px-4 lg:px-8 py-3 sm:py-6 ">
        <Header />

        {/* Page Header */}
        <div className="mt-4 sm:mt-8 mb-4 sm:mb-8 bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="relative bg-gradient-to-r from-[#1ca5b3] via-[#1398a5] to-[#0e7c87] p-4 sm:p-8">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxIDAgNiAyLjY5IDYgNnMtMi42OSA2LTYgNi02LTIuNjktNi02IDIuNjktNiA2LTZ6TTI0IDQyYzMuMzEgMCA2IDIuNjkgNiA2cy0yLjY5IDYtNiA2LTYtMi42OS02LTYgMi42OS02IDYtNnoiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLW9wYWNpdHk9Ii4xIiBzdHJva2Utd2lkdGg9IjIiLz48L2c+PC9zdmc+')] opacity-10"></div>
            <div className="relative flex items-center gap-3 sm:gap-4">
              <div className="bg-white/20 backdrop-blur-sm p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-white/30 shadow-lg">
                <ArrowLeftRight className="w-6 sm:w-10 h-6 sm:h-10 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight mb-1 sm:mb-2">Database Sync Tool</h1>
                <p className="text-white/95 text-sm sm:text-lg hidden sm:block">
                  Seamlessly synchronize data between PostgreSQL and MSSQL databases
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-3 sm:px-8 py-2 sm:py-4 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm text-gray-700">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CheckCircle className="w-4 sm:w-5 h-4 sm:h-5 text-green-600" />
                <span className="font-medium">Auto Table Creation</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CheckCircle className="w-4 sm:w-5 h-4 sm:h-5 text-green-600" />
                <span className="font-medium">Bulk Data Transfer</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CheckCircle className="w-4 sm:w-5 h-4 sm:h-5 text-green-600" />
                <span className="font-medium">Smart Type Mapping</span>
              </div>
            </div>
          </div>
        </div>

        {/* Source and Target Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 mb-3 sm:mb-6">
          <DBConfigPanel
            title="Source Database"
            dbType={sourceDB}
            config={sourceConfig}
            setConfig={setSourceConfig}
            onDBTypeChange={handleSourceDBChange}
            tables={sourceTables}
            onFetchTables={handleFetchSourceTables}
            isLoading={isLoadingSource}
            isSource={true}
            configMode={sourceConfigMode}
            setConfigMode={setSourceConfigMode}
            connectionUrl={sourceConnectionUrl}
            setConnectionUrl={setSourceConnectionUrl}
            onDisconnect={handleDisconnectSource}
            otherConfig={targetConfig}
            otherConfigMode={targetConfigMode}
            otherConnectionUrl={targetConnectionUrl}
          />

          <DBConfigPanel
            title="Target Database"
            dbType={targetDB}
            config={targetConfig}
            setConfig={setTargetConfig}
            onDBTypeChange={handleTargetDBChange}
            tables={targetTables}
            onFetchTables={handleFetchTargetTables}
            isLoading={isLoadingTarget}
            isSource={false}
            configMode={targetConfigMode}
            setConfigMode={setTargetConfigMode}
            connectionUrl={targetConnectionUrl}
            setConnectionUrl={setTargetConnectionUrl}
            onDisconnect={handleDisconnectTarget}
            onCopyConfig={handleCopyToTarget}
            otherConfig={sourceConfig}
            otherConfigMode={sourceConfigMode}
            otherConnectionUrl={sourceConnectionUrl}
          />
        </div>

        {/* Sync Strategy Selection */}
        {sourceTables.length > 0 && targetFetched && (
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 overflow-hidden mb-3 sm:mb-6">
            <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-indigo-50 border-b border-gray-100 px-3 sm:px-8 py-4 sm:py-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-xl sm:rounded-2xl shadow-lg">
                  <RefreshCw className="w-5 sm:w-7 h-5 sm:h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-1">
                    Sync Strategy
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600">Choose how to synchronize your data</p>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Replace Strategy */}
                <button
                  onClick={() => setSyncStrategy("replace")}
                  className={`text-left p-4 sm:p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${
                    syncStrategy === "replace"
                      ? "border-red-500 bg-gradient-to-br from-red-50 to-orange-50 shadow-lg"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${syncStrategy === "replace" ? "bg-red-500" : "bg-gray-300"}`}>
                      <Database className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Hard Sync (Replace)</h3>
                      <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                        Complete refresh - Deletes all existing data and inserts fresh data from source
                      </p>
                    </div>
                    {syncStrategy === "replace" && (
                      <CheckCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    )}
                  </div>

                  <div className="space-y-3 mb-4">
                    <div>
                      <p className="text-xs font-bold text-green-700 mb-1.5">✓ Benefits:</p>
                      <ul className="text-xs text-gray-700 space-y-1 ml-4">
                        <li>• Ensures 100% data consistency with source</li>
                        <li>• Removes orphaned/deleted records automatically</li>
                        <li>• Simple and predictable behavior</li>
                        <li>• No primary key required</li>
                        <li>• Faster for large datasets</li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-red-700 mb-1.5">⚠ Risks:</p>
                      <ul className="text-xs text-gray-700 space-y-1 ml-4">
                        <li>• <strong>ALL existing data will be deleted</strong></li>
                        <li>• Cannot preserve target-only data</li>
                        <li>• Longer downtime during sync</li>
                        <li>• Loses any manual changes in target</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
                    <span>Best for:</span>
                    <span className="text-gray-800">Complete refreshes, data warehouses, reporting databases</span>
                  </div>
                </button>

                {/* Merge Strategy */}
                <button
                  onClick={() => setSyncStrategy("merge")}
                  className={`text-left p-4 sm:p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${
                    syncStrategy === "merge"
                      ? "border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${syncStrategy === "merge" ? "bg-green-500" : "bg-gray-300"}`}>
                      <ArrowLeftRight className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Smart Sync (Merge)</h3>
                      <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                        Intelligent upsert - Inserts new records and updates existing ones based on primary key
                      </p>
                    </div>
                    {syncStrategy === "merge" && (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                  </div>

                  <div className="space-y-3 mb-4">
                    <div>
                      <p className="text-xs font-bold text-green-700 mb-1.5">✓ Benefits:</p>
                      <ul className="text-xs text-gray-700 space-y-1 ml-4">
                        <li>• Preserves existing data (no deletion)</li>
                        <li>• Updates only changed records</li>
                        <li>• Minimal downtime</li>
                        <li>• Incremental sync capability</li>
                        <li>• Safe for production systems</li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-red-700 mb-1.5">⚠ Risks:</p>
                      <ul className="text-xs text-gray-700 space-y-1 ml-4">
                        <li>• <strong>Requires primary key on tables</strong></li>
                        <li>• Does not delete orphaned records</li>
                        <li>• Slightly slower for full refreshes</li>
                        <li>• May leave stale data if records deleted in source</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
                    <span>Best for:</span>
                    <span className="text-gray-800">Continuous sync, live systems, incremental updates</span>
                  </div>
                </button>
              </div>

              {/* Important Notice */}
              <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-bold text-yellow-900 mb-1">Important:</p>
                    <p className="text-xs text-yellow-800 leading-relaxed">
                      {syncStrategy === "replace" ? (
                        <><strong>Hard Sync will permanently delete all data in target tables</strong> before inserting new data. Make sure you have backups if needed. This operation cannot be undone.</>
                      ) : (
                        <>Merge strategy requires tables to have primary keys defined. Tables without primary keys will automatically fall back to Hard Sync (replace) mode.</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table Selection and Sync */}
        {sourceTables.length > 0 && (
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-purple-50 border-b border-gray-100 px-3 sm:px-8 py-4 sm:py-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="bg-gradient-to-br from-[#1ca5b3] to-[#0e7c87] p-2 rounded-xl sm:rounded-2xl shadow-lg">
                  <Table className="w-5 sm:w-7 h-5 sm:h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg  font-bold text-gray-900 mb-1">
                    Select Tables to Sync
                  </h2>
                  {!targetFetched ? (
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-2 bg-red-100 border border-red-300 text-red-800 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg inline-flex text-xs sm:text-sm">
                      <span className="text-sm sm:text-lg">⚠️</span>
                      <span className="font-semibold">Connect to target database to sync</span>
                    </div>
                  ) : targetTables.length === 0 ? (
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-2 bg-amber-100 border border-amber-300 text-amber-800 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg inline-flex text-xs sm:text-sm">
                    
                      <span className="font-semibold">Target is empty - All tables could be created</span>
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm text-gray-600">Choose which tables to synchronize from source to target</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-8">
              <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
                <Checkbox
                  checked={selectedTables.length === sourceTables.length}
                  indeterminate={
                    selectedTables.length > 0 &&
                    selectedTables.length < sourceTables.length
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTables(sourceTables);
                    } else {
                      setSelectedTables([]);
                    }
                  }}
                >
                  <span className="font-semibold text-base sm:text-lg">Select All Tables</span>
                </Checkbox>

                {targetTables.length > 0 && (
                  <div className="flex gap-2 sm:ml-auto">
                    <button
                      onClick={() => setShowNewTables(!showNewTables)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        showNewTables
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      New ({sourceTables.filter(t => !targetTables.includes(t)).length})
                    </button>
                    <button
                      onClick={() => setShowExistingTables(!showExistingTables)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        showExistingTables
                          ? "bg-green-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      Existing ({sourceTables.filter(t => targetTables.includes(t)).length})
                    </button>
                  </div>
                )}
              </div>  {showExistingTables && sourceTables.filter(t => targetTables.includes(t)).length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm sm:text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        Will be Synced ({sourceTables.filter(t => targetTables.includes(t)).length})
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                        {sourceTables.filter(t => targetTables.includes(t)).map((table) => (
                          <div
                            key={table}
                            className={`p-2 sm:p-3 rounded-lg border-2 transition-all duration-200 ${
                              selectedTables.includes(table)
                                ? "border-green-600 bg-green-50 shadow-md"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          >
                            <Checkbox
                              checked={selectedTables.includes(table)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTables([...selectedTables, table]);
                                } else {
                                  setSelectedTables(selectedTables.filter((t) => t !== table));
                                }
                              }}
                            >
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <Table className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-green-600 flex-shrink-0" />
                                  <span className="font-mono font-semibold text-xs sm:text-sm text-gray-800 truncate">{table}</span>
                                </div>
                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded w-fit">↻ Sync</span>
                              </div>
                            </Checkbox>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

              {/* Show grouped sections only if target is connected */}
              {targetTables.length > 0 ? (
                <>
                  {/* New Tables Section */}
                  {showNewTables && sourceTables.filter(t => !targetTables.includes(t)).length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm sm:text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        Will be Created ({sourceTables.filter(t => !targetTables.includes(t)).length})
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                        {sourceTables.filter(t => !targetTables.includes(t)).map((table) => (
                          <div
                            key={table}
                            className={`p-2 sm:p-3 rounded-lg border-2 transition-all duration-200 ${
                              selectedTables.includes(table)
                                ? "border-blue-600 bg-blue-50 shadow-md"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          >
                            <Checkbox
                              checked={selectedTables.includes(table)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTables([...selectedTables, table]);
                                } else {
                                  setSelectedTables(selectedTables.filter((t) => t !== table));
                                }
                              }}
                            >
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <Table className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-blue-600 flex-shrink-0" />
                                  <span className="font-mono font-semibold text-xs sm:text-sm text-gray-800 truncate">{table}</span>
                                </div>
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded w-fit">New</span>
                              </div>
                            </Checkbox>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Existing Tables Section */}
                
                </>
              ) : (
                /* Show all tables when no target is connected */
                <div className="mb-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                    {sourceTables.map((table) => (
                      <div
                        key={table}
                        className={`p-2 sm:p-3 rounded-lg border-2 transition-all duration-200 ${
                          selectedTables.includes(table)
                            ? "border-[#1ca5b3] bg-blue-50 shadow-md"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <Checkbox
                          checked={selectedTables.includes(table)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTables([...selectedTables, table]);
                            } else {
                              setSelectedTables(selectedTables.filter((t) => t !== table));
                            }
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <Table className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#1ca5b3] flex-shrink-0" />
                            <span className="font-mono font-semibold text-xs sm:text-sm text-gray-800 truncate">{table}</span>
                          </div>
                        </Checkbox>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                type="primary"
                onClick={handleSync}
                disabled={selectedTables.length === 0 || isSyncing || !targetFetched}
                className={`w-full !rounded-lg !font-semibold !shadow-lg hover:!shadow-xl transition-all duration-300 ${
                  syncStrategy === "replace"
                    ? "!bg-gradient-to-r !from-red-500 !via-orange-500 !to-red-600 hover:!from-red-600 hover:!to-orange-700"
                    : "!bg-gradient-to-r !from-green-500 !via-emerald-500 !to-teal-600 hover:!from-green-600 hover:!to-teal-700"
                } !text-white`}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                {!targetFetched
                  ? "Connect Target Database First"
                  : `${syncStrategy === "replace" ? "Hard Sync" : "Smart Sync"} ${selectedTables.length} Table${selectedTables.length !== 1 ? "s" : ""}`
                }
              </Button>
            </div>
          </div>
        )}

        {/* Sync Progress */}
        {syncProgress.length > 0 && (
          <div className="mt-4 sm:mt-8 bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 border-b border-gray-100 px-3 sm:px-8 py-4 sm:py-6">
              <div className="flex items-center gap-4">
                <div className="bg-green-600 p-4 rounded-2xl shadow-lg">
                  <CheckCircle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">Sync Results</h2>
                  <p className="text-sm text-gray-600 mt-1">Summary of synchronization operations</p>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-8 space-y-3 sm:space-y-4">
              {syncProgress.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-3 sm:p-6 rounded-xl sm:rounded-2xl border-2 shadow-lg transition-all duration-200 hover:shadow-xl ${
                    result.success
                      ? "border-green-300 bg-gradient-to-r from-green-50 to-emerald-50"
                      : "border-red-300 bg-gradient-to-r from-red-50 to-rose-50"
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className={`p-1.5 sm:p-2 rounded-lg ${result.success ? 'bg-green-600' : 'bg-red-600'}`}>
                      {result.success ? (
                        <CheckCircle className="w-4 sm:w-6 h-4 sm:h-6 text-white" />
                      ) : (
                        <RefreshCw className="w-4 sm:w-6 h-4 sm:h-6 text-white" />
                      )}
                    </div>
                    <span className="font-mono font-bold text-sm sm:text-lg text-gray-900 truncate">
                      {result.table}
                    </span>
                    <div className="flex items-center gap-2 ml-auto">
                      {result.strategy && (
                        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-md ${
                          result.strategy.includes('replace')
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : 'bg-green-100 text-green-700 border border-green-300'
                        }`}>
                          {result.strategy.includes('replace') ? '🔄' : '⇄'}
                          <span className="hidden sm:inline capitalize">{result.strategy.replace('replace (no PK)', 'replace')}</span>
                        </span>
                      )}
                      {result.tableCreated && (
                        <span className="flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-md">
                          <span>✨</span>
                          <span className="hidden sm:inline">Created</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <p
                    className={`text-xs sm:text-base font-medium mb-2 ${
                      result.success ? "text-green-800" : "text-red-800"
                    }`}
                  >
                    {result.message}
                  </p>
                  {result.rowsAffected !== undefined && (
                    <div className="flex flex-wrap gap-2">
                      {result.rowsInserted > 0 && (
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-700 bg-green-50 border border-green-200 px-2 sm:px-3 py-1 rounded-lg">
                          <span className="font-semibold">📥 Inserted:</span>
                          <span className="font-bold text-green-700">{result.rowsInserted.toLocaleString()}</span>
                        </div>
                      )}
                      {result.rowsUpdated > 0 && (
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-700 bg-blue-50 border border-blue-200 px-2 sm:px-3 py-1 rounded-lg">
                          <span className="font-semibold">🔄 Updated:</span>
                          <span className="font-bold text-blue-700">{result.rowsUpdated.toLocaleString()}</span>
                        </div>
                      )}
                      {result.rowsDeleted > 0 && (
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-700 bg-red-50 border border-red-200 px-2 sm:px-3 py-1 rounded-lg">
                          <span className="font-semibold">🗑️ Deleted:</span>
                          <span className="font-bold text-red-700">{result.rowsDeleted.toLocaleString()}</span>
                        </div>
                      )}
                      {result.rowsAffected === 0 && (
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-700 bg-gray-50 border border-gray-200 px-2 sm:px-3 py-1 rounded-lg">
                          <span className="font-semibold">No changes</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DBSyncTool;
