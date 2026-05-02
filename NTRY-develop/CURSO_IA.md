# 📘 Resumen del Curso: Inteligencia Artificial y Aprendizaje Automático

## 1. Introducción al Aprendizaje Automático (Clase 4)

El **Aprendizaje Automático (Machine Learning)** es la capacidad de las máquinas para aprender patrones a partir de datos sin ser programadas explícitamente para cada tarea.

### 🔄 Ciclo de Vida de la Ciencia de Datos

- **Business Understanding:** Definir los objetivos del problema.  
- **Data Mining:** Recolección de datos necesarios.  
- **Data Cleaning:** Corrección de inconsistencias y valores faltantes.  
- **Data Exploration:** Formulación de hipótesis mediante análisis visual.  
- **Feature Engineering:** Selección y construcción de características significativas.  
- **Predictive Modeling:** Entrenamiento y evaluación de modelos.  
- **Data Visualization:** Comunicación de hallazgos.  

---

## 2. Regresión Lineal Simple (Clases 5 y 6)

La regresión busca establecer una relación funcional entre una variable independiente (**x**) y una dependiente (**y**).

### 📐 Modelo Matemático
```math
y = mx + b
```

- **m:** pendiente  
- **b:** intercepto  

### 🎯 Objetivo
Encontrar la línea que mejor se ajuste a los datos minimizando el error.

### 📊 Métrica de Evaluación
- **R² (Coeficiente de Determinación):**  
  Indica qué tan bien el modelo explica la variabilidad de los datos.  
  Valores cercanos a **1** → mejor ajuste.

### 🛠 Herramienta
- `scikit-learn` en Python para automatizar el proceso.

---

## 3. Regresión Polinómica (Clase 7)

Se usa cuando la relación entre variables no es lineal.

### 📐 Modelo
```math
y = b_0 + b_1x + b_2x^2 + ... + b_nx^n
```

### ⚠️ Consideraciones
- Mayor grado → mejor ajuste a curvas  
- Riesgo: **Overfitting (sobreajuste)**  

---

## 4. Fundamentos de Clasificación (Clase 8)

A diferencia de la regresión, la clasificación predice **categorías o etiquetas**.

### 🧠 Tipos de Aprendizaje
- **Supervisado:** Datos etiquetados (ej: SPAM / NO-SPAM)  
- **No Supervisado:** Sin etiquetas (ej: clustering)  

### 📊 Matriz de Confusión

- **TP (Verdaderos Positivos)**  
- **TN (Verdaderos Negativos)**  
- **FP (Falsos Positivos)** → Error Tipo I  
- **FN (Falsos Negativos)** → Error Tipo II  

### 📏 Métricas

- **Accuracy:**  
```math
(TP + TN) / Total
```

- **Precisión:**  
```math
TP / (TP + FP)
```

- **Recall (Sensibilidad):**  
```math
TP / (TP + FN)
```

---

## 5. Modelos de Entrenamiento y Clasificadores Binarios (Clase 9)

### 🤖 Algoritmos Comunes

- **Regresión Logística**
- **K-Nearest Neighbors (KNN)**
- **Árboles de Decisión**
- **Random Forest**

### 🧹 Preparación de Datos

- Eliminación de nulos  
- Conversión de texto a valores numéricos  
- Normalización (escala [0,1])  
- División de datos:
  - Entrenamiento: 60%
  - Validación: 20%
  - Prueba: 20%

---

## 6. Clasificadores Multiclase (Clase 10)

### 🔄 Estrategias

- **One-vs-All (OvA):** Una clase contra todas  
- **One-vs-One (OvO):** Comparación por pares  

### ⚖️ Conceptos Clave

- **Bias (Sesgo):**  
  Error por suposiciones incorrectas → *Underfitting*  

- **Variance (Varianza):**  
  Sensibilidad a datos → *Overfitting*  

### 📈 Curvas de Validación

Permiten encontrar el equilibrio entre:
- Error de entrenamiento  
- Error de validación  

---

## ✅ Conclusión

Este curso introduce los fundamentos esenciales del Machine Learning, desde el flujo de trabajo en ciencia de datos hasta modelos de regresión y clasificación, incluyendo métricas, evaluación y conceptos clave como bias y variance.