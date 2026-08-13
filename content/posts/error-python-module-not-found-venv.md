---
title: "Cómo solucionar el error ModuleNotFoundError en Python dentro de Virtualenv"
description: "Solución completa al error ModuleNotFoundError en entornos virtuales Python (venv): verificación de activación, rutas de intérprete en IDE y PYTHONPATH."
category: "Web y Código"
tags: ["Python", "Virtualenv", "Programming"]
readTime: "3 min"
date: "2026-07-27"
---

El error `ModuleNotFoundError: No module named 'nombre_modulo'` es una de las excepciones más comunes en Python. Ocurre cuando el intérprete intenta importar una librería externa o módulo interno que no está presente en la ruta de búsqueda de paquetes (`sys.path`) de la instancia activa de Python.

## Diagnóstico Rápido

| Causa | Solución |
|---|---|
| **`ModuleNotFoundError: No module named 'libreria'`**: El script se ejecuta con el Python global del sistema o la librería se instaló fuera del entorno virtual activo | Activar el virtualenv (`source venv/bin/activate`), verificar la ruta del binario e instalar la librería con `python -m pip install` |

## 🚀 Cómo solucionar el error paso a paso

### Paso 1: Confirmar la activación del entorno virtual

Comprueba si tu entorno virtual está activo y verifica cuál intérprete de Python se está ejecutando:

```bash
# En Linux / macOS: activar entorno virtual
source venv/bin/activate

# En Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# Verificar qué intérprete está respondiendo
which python    # En Linux/macOS
where python    # En Windows
```

*(La salida debe apuntar a la ruta interna de tu carpeta `venv/bin/python`, no a `/usr/bin/python`).*

### Paso 2: Instalar la dependencia usando la sintaxis del módulo pip

Para garantizar que los paquetes se instalen dentro del entorno virtual correspondiente y no en el sistema global, instala siempre usando `python -m pip`:

```bash
python -m pip install nombre_modulo
```

Para verificar que la librería se instaló correctamente en el entorno activo:

```bash
python -m pip list
```

### Paso 3: Configurar el intérprete de Python en tu IDE (VS Code / PyCharm)

Si el script funciona desde la consola pero falla dentro de tu editor de código:

- **VS Code**: Presiona `Ctrl + Shift + P` (o `Cmd + Shift + P` en Mac), escribe `Python: Select Interpreter` y selecciona el binario localizado dentro de la carpeta `venv/bin/python`.
- **PyCharm**: Ve a `Settings` > `Project` > `Python Interpreter` y selecciona el entorno virtual creado en el proyecto.

## 🛡️ Consejos de Prevención

- **Utilizar `requirements.txt` o `pyproject.toml`**: Mantén un registro actualizado de las dependencias instaladas en tu proyecto ejecutando `pip freeze > requirements.txt`.
- **Evitar mezclar entornos de sistema con proyectos**: Nunca instales librerías de proyectos con `sudo pip install`.
- **Usar siempre `python -m pip`**: Invocar `pip` directamente puede apuntar a una versión global distinta si las variables de entorno `$PATH` no están sincronizadas.
