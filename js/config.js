// RDP Pro — Configuração centralizada
// Para ambiente de teste, altere IS_DEV para true e preencha TEST_*

const IS_DEV = false; // mude para true em desenvolvimento local

const CONFIG = {
  supabase: {
    url: "https://ofojfewdeamfackofjgt.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mb2pmZXdkZWFtZmFja29mamd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzQwMjMsImV4cCI6MjA5NDUxMDAyM30.UCo5czC_I4GZwogk4ZRVDL-CyFKMBHhF-q76zVksmUQ",
  },
  // E-mail de teste (substitui o do psicólogo em modo dev)
  devEmail: IS_DEV ? "vinnitog@gmail.com" : null,
  isDev: IS_DEV,
  appVersion: "1.0.0",
  maxCycleDays: 10, // padrão, sobrescrito pelas settings do psicólogo
};

// Exporta como global para uso em todos os módulos
window.RDP_CONFIG = CONFIG;
