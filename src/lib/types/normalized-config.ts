export interface DeviceInfo {
  vendor: string;
  model: string;
  os_version: string;
  hostname: string;
  serial?: string;
  ha_status: 'Active-Passive' | 'Active-Active' | 'Standalone' | 'Unknown';
}

export interface AdminAccount {
  name: string;
  mfa_enabled: boolean;
  trusted_hosts: string[];
  profile: string;
  password_policy_strong: boolean;
}

export interface ManagementAccess {
  https: boolean;
  http: boolean;
  ssh: boolean;
  telnet: boolean;
  snmp: boolean;
  snmp_community_default: boolean;
  allowed_from_wan: boolean;
  trusted_hosts: string[];
}

export interface LoggingConfig {
  traffic_log: boolean;
  security_log: boolean;
  remote_log_enabled: boolean;
  remote_targets: string[];
  event_logging_enabled?: boolean;
  fortianalyzer?: {
    enabled: boolean;
    reliable: boolean;
    enc_algorithm: string;
  };
  syslog?: {
    enabled: boolean;
    reliable: boolean;
    enc_algorithm: string;
  };
}

export interface NetworkInterface {
  name: string;
  zone?: string;
  ip: string;
  allowaccess: string[];
}

export interface FirewallRule {
  id: string | number;
  name?: string;
  src_zone?: string;
  dst_zone?: string;
  src: string[];
  dst: string[];
  service: string[];
  action: 'accept' | 'deny' | 'reject' | string;
  logging_enabled: boolean;
  logtraffic?: string;
  profiles: string[];
  ips_sensor?: string;
  av_profile?: string;
  dnsfilter_profile?: string;
  webfilter_profile?: string;
  app_profile?: string;
  has_isdb?: boolean;
  enabled: boolean;
  comment?: string;
  schedule?: string;
  raw_snippet?: string;
}

export interface AddressObject {
  name: string;
  type: string;
  value: string;
  used: boolean;
}

export interface ServiceObject {
  name: string;
  protocol: string;
  port?: string;
  used: boolean;
}

export interface VpnConfig {
  ssl_vpn_enabled: boolean;
  ipsec_enabled: boolean;
  users: string[];
  encryption_strong: boolean;
  mfa_enabled: boolean;
  inactive_users_retained: boolean;
  ssl_server_certificate?: string;
  ssl_max_tls_version?: string;
  ssl_min_tls_version?: string;
  ssl_algorithm?: string;
}

export interface SystemConfig {
  firmware_outdated: boolean;
  ntp_configured: boolean;
  ntp_server?: string;
  dns_servers: string[];
  dns_is_default?: boolean;
  backup_configured: boolean;
  pre_login_banner_enabled?: boolean;
  post_login_banner_enabled?: boolean;
  timezone?: string;
  usb_auto_install_disabled?: boolean;
  ssl_static_key_ciphers_disabled?: boolean;
  strong_crypto_enabled?: boolean;
  admin_https_ssl_versions?: string[];
  gui_cdn_usage_enabled?: boolean;
  log_single_cpu_high_enabled?: boolean;
  gui_display_hostname_disabled?: boolean;
  admin_lockout_threshold?: number;
  admin_lockout_duration?: number;
  admin_idle_timeout?: number;
  admin_port?: number;
  admin_sport?: number;
  https_redirect_disabled?: boolean;
  virtual_patch_enabled?: boolean;
}

export interface PasswordPolicyConfig {
  enabled: boolean;
  min_length: number;
  scope?: string;
  apply_to?: string[];
}

export interface SnmpConfig {
  v1_v2c_enabled: boolean;
  v3_users: {
    name: string;
    notify_hosts: string[];
    queries_disabled?: boolean;
  }[];
  trap_thresholds?: string[];
}

export interface HaConfig {
  mode: string;
  group_name?: string;
  hbdev?: string[];
  monitor_interfaces?: string[];
  reserved_mgmt?: {
    enabled: boolean;
    interface?: string;
    gateway?: string;
  };
  group_id?: number;
}

export interface SecurityProfilesConfig {
  ips?: { name: string; scan_botnet_connections?: boolean; raw_snippet?: string; }[];
  av?: { autoupdate_schedule?: string; outbreak_prevention?: string; machine_learning_detection?: boolean; grayware?: boolean; sandbox_inline?: boolean; cdr?: boolean; profiles?: { name: string; raw_snippet?: string; }[] };
  dnsfilter?: { name: string; redirect_botnet?: boolean; log_all_domain?: boolean; raw_snippet?: string; }[];
  webfilter?: { name: string; blocks_malicious?: boolean; raw_snippet?: string; }[];
  app?: { name: string; block_high_risk?: boolean; enforce_default_app_port?: boolean; log_all?: boolean; raw_snippet?: string; }[];
}

export interface SecurityFabricConfig {
  quarantine_stitch_enabled?: boolean;
  root_fabric_enabled?: boolean;
}

export interface NormalizedConfig {
  device: DeviceInfo;
  admin_accounts: AdminAccount[];
  management_access: ManagementAccess;
  logging: LoggingConfig;
  interfaces: NetworkInterface[];
  firewall_rules: FirewallRule[];
  address_objects: AddressObject[];
  service_objects: ServiceObject[];
  vpn: VpnConfig;
  system: SystemConfig;
  password_policy?: PasswordPolicyConfig;
  snmp?: SnmpConfig;
  ha?: HaConfig;
  security_profiles?: SecurityProfilesConfig;
  security_fabric?: SecurityFabricConfig;
  zones?: { name: string; intrazone_deny: boolean; }[];
  local_in_policies?: { id: string; action: string; service?: string[]; }[];
  raw_content?: string;
}
