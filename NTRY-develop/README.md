# 🛡️ NTRY AI Log Monitor: DevSecOps Intelligent Platform

## 🎯 Objetivo del Proyecto
Desarrollar una plataforma de monitoreo inteligente capaz de detectar comportamientos anómalos o ataques en tiempo real. El sistema utiliza técnicas de **Machine Learning** sobre una arquitectura de contenedores desplegada en la nube para automatizar la vigilancia de seguridad.

## ⚠️ El Problema que Resuelve
Las organizaciones enfrentan volúmenes masivos de logs difíciles de analizar manualmente, lo que genera:
* 📉 **Baja visibilidad** de incidentes.
* 🐢 **Detección tardía** de ataques.
* 🔓 **Mayor riesgo** de vulnerabilidades críticas.

**NTRY** automatiza esta tarea, pasando de una defensa reactiva a una **proactiva**.

---

## 🏗️ Arquitectura y Componentes

El ecosistema se despliega en **AWS EC2** bajo una orquestación de **Docker**, dividiéndose en los siguientes módulos:

1.  **Generador de Ataques:** Simula tráfico real y malicioso (Fuerza bruta, escaneo de puertos, múltiples requests).
2.  **App Vulnerable (Microservicio):** El origen de los datos; genera logs de logins, errores y peticiones HTTP.
3.  **Log Collector (Python):** Script que extrae, estructura y normaliza los logs.
4.  **Persistencia (MongoDB):** Base de datos NoSQL en la nube donde se centralizan los eventos.
5.  **Procesador de Features:** Transforma logs crudos en métricas para la IA (ej: `failed_logins`, `error_rate`, `unique_ips`).
6.  **IA Detector:** Modelo entrenado con datasets reales (**CICIDS2017 / UNSW-NB15**) para clasificar tráfico normal vs. anómalo.

---

## 🔄 Flujo Completo del Sistema

El flujo de datos sigue un ciclo cerrado desde la generación hasta la alerta:

```mermaid
graph TD
    subgraph "Generación"
    A[Simulador de Ataques] --> B[App Vulnerable]
    end

    subgraph "Ingesta"
    B -->|Logs Crudos| C[Log Collector Python]
    C --> D[(MongoDB en AWS)]
    end

    subgraph "Inteligencia"
    D --> E[Feature Engineering]
    E --> F[Modelo de IA / ML]
    end

    subgraph "Respuesta"
    F --> G{¿Anomalía?}
    G -->|Sí| H[🚨 Alerta Detectada]
    G -->|No| I[✅ Tráfico Seguro]
    end
