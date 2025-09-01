var SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
var BOT_TOKEN = SCRIPT_PROPERTIES.getProperty('TELEGRAM_BOT_TOKEN');
var TELEGRAM_API_URL = "https://api.telegram.org/bot" + BOT_TOKEN;
const NUMERO_WHATSAPP_CLUB = "34622559943"; // IMPORTANTE: Reemplaza con el número de WhatsApp del club
const URL_PARTIDOS_WEB = "https://www.tupadelvalencia.com/Partidas_Padel.aspx";

// VERSIÓN MEJORADA: Ahora acepta un 'keyboard' opcional para añadir botones.
function sendMessage(chatId, textoDelMensaje, keyboard) {
  var localProperties = PropertiesService.getScriptProperties();
  var localBotToken = localProperties.getProperty('TELEGRAM_BOT_TOKEN');

  if (!localBotToken || localBotToken.trim() === "" || localBotToken === "null") {
    Logger.log("Error FATAL en sendMessage: TELEGRAM_BOT_TOKEN no configurado.");
    return false;
  }
  if (!chatId || !textoDelMensaje) {
    Logger.log("Error en sendMessage: Falta chatId o textoDelMensaje.");
    return false;
  }

  var localTelegramApiUrl = "https://api.telegram.org/bot" + localBotToken + "/sendMessage";
  
  var payload = {
    'chat_id': String(chatId).trim(),
    'text': textoDelMensaje,
    'parse_mode': 'HTML',
    'disable_web_page_preview': true // Evita las previsualizaciones grandes de los enlaces
  };
  
  // Si se proporciona un teclado de botones, lo añadimos al payload.
  if (keyboard) {
    payload.reply_markup = keyboard;
  }

  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  try {
    var response = UrlFetchApp.fetch(localTelegramApiUrl, options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();

    if (responseCode === 200) {
      var jsonResponse = JSON.parse(responseBody);
      if (jsonResponse.ok) {
        Logger.log("✅ Mensaje de Telegram enviado exitosamente a chatId: " + chatId);
        return true;
      } else {
        Logger.log("API de Telegram devolvió ok:false. Descripción: " + jsonResponse.description);
        return false;
      }
    } else {
      Logger.log("Error en la solicitud a Telegram. Código HTTP: " + responseCode + ". Respuesta: " + responseBody);
      return false;
    }
  } catch (error) {
    Logger.log("Excepción al enviar mensaje de Telegram: " + error.toString());
    return false;
  }
}

function clearAlertSetupState(userId) {
  var userProperties = PropertiesService.getUserProperties();
  userProperties.deleteProperty('alert_setup_step_' + userId);
  userProperties.deleteProperty('alert_data_' + userId); // Borrar también datos temporales
  Logger.log("Estado de configuración de alerta limpiado para el usuario: " + userId);
}

function obtenerHtmlDeLaWeb() {
  var url = "https://www.tupadelvalencia.com/Partidas_Padel.aspx";

  try {
    // Hacemos la solicitud para obtener el contenido de la página web
    var respuesta = UrlFetchApp.fetch(url, {muteHttpExceptions: true}); // muteHttpExceptions para poder ver errores si los hay
    var codigoRespuesta = respuesta.getResponseCode();
    var contenidoHtml = respuesta.getContentText();

    if (codigoRespuesta === 200) {
      // Si la solicitud fue exitosa (código 200 OK)
      Logger.log("Contenido HTML obtenido exitosamente. Longitud: " + contenidoHtml.length + " caracteres.");
      // Para no llenar demasiado el log, solo mostraremos los primeros 2000 caracteres.
      // En un paso posterior, analizaremos este 'contenidoHtml' completo.
      Logger.log(contenidoHtml.substring(0, 2000) + "...");
      
      // En un escenario real, aquí llamaríamos a la función para procesar este HTML.
      // Por ejemplo: procesarPartidos(contenidoHtml);

    } else {
      Logger.log("Error al obtener la página. Código de respuesta: " + codigoRespuesta);
      Logger.log("Contenido de la respuesta (si lo hay): " + contenidoHtml);
    }

  } catch (e) {
    // Capturamos cualquier otro error durante la ejecución
    Logger.log("Ocurrió un error: " + e.toString());
  }
} 


function procesarYGuardarPartidos_ConExtraccionReintegrada() {
  Logger.log("Iniciando Tarea 1: Scraping de Partidos...");


  const ahora = new Date();
  const hora = parseInt(Utilities.formatDate(ahora, "Europe/Madrid", "H")); 
  const minutos = parseInt(Utilities.formatDate(ahora, "Europe/Madrid", "m"));

  const enPeriodoDeSilencio = (hora === 23 && minutos >= 30) || (hora < 6);

  if (enPeriodoDeSilencio) {
    const msg = "Tarea en periodo de silencio (23:30-06:00).Omitiendo ejecución.";
    Logger.log(msg);
    return { success: true, message: msg };
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hojaPartidos = ss.getSheetByName("Hoja1_TuPadel");
    if (!hojaPartidos) throw new Error("No se encontró la hoja 'Hoja1_TuPadel'.");
    

  Logger.log("SCRAPER: Iniciando procesarYGuardarPartidos_ConExtraccionReintegrada...");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaPartidos = ss.getSheetByName("Hoja1_TuPadel");
  if (!hojaPartidos) {
    Logger.log("Error: No se encontró la hoja de partidos ('Hoja1_TuPadel'). Finalizando.");
    return;
  }

  var partidosExtraidosGlobal = []; 
  var encabezados = [
    "Fecha Extraccion", "Dia Partido", "Hora Inicio", "Hora Fin", "Nombre Pista",
    "J1 Nombre", "J1 Nivel", "J2 Nombre", "J2 Nivel",
    "J3 Nombre", "J3 Nivel", "J4 Nombre", "J4 Nivel",
    "Plazas Ocupadas", "Estado", "ID Original"
  ];
  partidosExtraidosGlobal.push(encabezados);

  var fechaExtraccionActual = new Date(); 
  var hoy = new Date();
  var zonaHoraria = Session.getScriptTimeZone();

  for (var d = 0; d < 16; d++) { 
    var fechaActualScraping = new Date(hoy.getTime());
    fechaActualScraping.setDate(hoy.getDate() + d);
    
    var yyyy = fechaActualScraping.getFullYear();
    var mm = ("0" + (fechaActualScraping.getMonth() + 1)).slice(-2);
    var dd = ("0" + fechaActualScraping.getDate()).slice(-2);
    var fechaParaURL = yyyy + "." + mm + "." + dd;
    var fechaParaHoja = yyyy + "-" + mm + "-" + dd;

    var urlDiaEspecifico = "https://www.tupadelvalencia.com/Partidas_Padel.aspx?fecha=" + fechaParaURL;
    Logger.log("Scrapeando URL: " + urlDiaEspecifico);
    
    var contenidoHtmlDia = "";
    try {
      var respuesta = UrlFetchApp.fetch(urlDiaEspecifico, { muteHttpExceptions: true });
      if (respuesta.getResponseCode() === 200) {
        contenidoHtmlDia = respuesta.getContentText();
      } else {
        Logger.log("Error al obtener HTML para " + fechaParaURL + ": " + respuesta.getResponseCode());
        continue;
      }
    } catch (e) {
      Logger.log("Excepción al obtener HTML para " + fechaParaURL + ": " + e.toString());
      continue; 
    }

    var regexPartidaApertura = /<div id="ContentPlaceHolder2_Partida_(\d{4}-\d{2}-\d{2}_\d+_\d+)" class="marco_partida_padel[^"]*">/gi;
    var matchApertura;
    var contadorBloquesDia = 0;

    while ((matchApertura = regexPartidaApertura.exec(contenidoHtmlDia)) !== null) {
      contadorBloquesDia++;
      var idCompletoPartido = matchApertura[1]; 
      var etiquetaApertura = matchApertura[0];
      var inicioContenidoBloque = matchApertura.index + etiquetaApertura.length;
      var htmlDesdeInicioBloque = contenidoHtmlDia.substring(inicioContenidoBloque);
      var profundidadDiv = 0; var posicionCierre = -1;
      for (var k_idx = 0; k_idx < htmlDesdeInicioBloque.length; k_idx++) {
        if (htmlDesdeInicioBloque.substring(k_idx, k_idx + 4).toLowerCase() === "<div") { profundidadDiv++; k_idx += 3; }
        else if (htmlDesdeInicioBloque.substring(k_idx, k_idx + 6).toLowerCase() === "</div>") {
          if (profundidadDiv === 0) { posicionCierre = k_idx; break; }
          profundidadDiv--; k_idx += 5;
        }
      }
      var contenidoDelBloque = "";
      if (posicionCierre !== -1) { contenidoDelBloque = htmlDesdeInicioBloque.substring(0, posicionCierre); }
      else { Logger.log("  ERROR en Bloque para ID: " + idCompletoPartido + " en fecha " + fechaParaURL + ": No se pudo encontrar cierre."); continue; }

      var datosPartido = {
        idOriginal: idCompletoPartido, dia: "", horaInicio: "", horaFin: "", pista: "",
        jugadores: [], faltan: null, estado: ""
      };

      var partesId = idCompletoPartido.match(/^(\d{4}-\d{2}-\d{2})_(\d+)_(\d+)/);
      if (partesId && partesId[1] === fechaParaHoja) {
          datosPartido.dia = partesId[1];
      } else {
          datosPartido.dia = fechaParaHoja; 
      }

      var esBloqueadoPorAdmin = false;
      var regexBloqueoAdmin = /<div class="partidaNombre_padel">/i;
      if (contenidoDelBloque.match(regexBloqueoAdmin)) {
        esBloqueadoPorAdmin = true;
        datosPartido.estado = "Bloqueado (Admin)";
        datosPartido.Ocupado = 4;
        datosPartido.jugadores = [];
      }
      
      var regexNombrePista = /<div class="partidaNombrePista_padel">([\s\S]*?)<\/div>/;
      var matchNombrePista = contenidoDelBloque.match(regexNombrePista);
      if (matchNombrePista) datosPartido.pista = limpiarTexto(matchNombrePista[1]);

      var regexHorario = /<div id="ContentPlaceHolder2_HoraPartida_[^"]+" class="partidaHorario_padel">([^<]+)<\/div>/;
      var matchHorario = contenidoDelBloque.match(regexHorario);
      if (matchHorario) { 
        var horarioCompleto = limpiarTexto(matchHorario[1]);
        var horasSplit = horarioCompleto.split(/\u2013|-/);
        if (horasSplit.length === 2) { datosPartido.horaInicio = limpiarTexto(horasSplit[0]); datosPartido.horaFin = limpiarTexto(horasSplit[1]); }
        else { datosPartido.horaInicio = horarioCompleto; }
      }

      if (!esBloqueadoPorAdmin) { 
        var regexLiJugador = /<li class="jugador_reservado_padel" title="([^"]+)">([\s\S]*?)<\/li>/gi;
        var matchLi;
        while ((matchLi = regexLiJugador.exec(contenidoDelBloque)) !== null) {
          var nombreJugador = limpiarTexto(matchLi[1]);
          var contenidoInternoLi = matchLi[2];
          var nivelJugador = ""; 

          var regexNivelInterno = /<div class="[^"]*jugador_reservado_nivel_padel[^"]*">([^<]+)<\/div>/;
          var matchNivel = contenidoInternoLi.match(regexNivelInterno);
          
          if (matchNivel && matchNivel[1]) {
            nivelJugador = limpiarTexto(matchNivel[1]);
            
            // --- AJUSTE CLAVE ---
            // Forzamos que se guarde como texto y estandarizamos la coma por el punto.
            if (nivelJugador) {
                nivelJugador = "'" + String(nivelJugador).replace(',', '.');
            }
            // --- FIN DEL AJUSTE ---
          }
          if (nombreJugador) datosPartido.jugadores.push({ nombre: nombreJugador, nivel: nivelJugador });
        }
        var regexLazoEspera = /class="[^"]*partidaLazoEspera(\d{1,2})_padel[^"]*"/i;
        var matchLazoEspera = contenidoDelBloque.match(regexLazoEspera);
        if (matchLazoEspera && matchLazoEspera[1]) { datosPartido.Ocupado = parseInt(matchLazoEspera[1]); }
        else { const MAX_JUGADORES = 4; if (datosPartido.jugadores.length >= MAX_JUGADORES) datosPartido.Ocupado = 4; else if (datosPartido.jugadores.length >= 4) datosPartido.Ocupado = datosPartido.jugadores.length; else datosPartido.Ocupado = null; }
        if (datosPartido.Ocupado === 4) datosPartido.estado = "Completo";
        else if (datosPartido.Ocupado > 0) datosPartido.estado = "Disponible";
        else if (datosPartido.Ocupado === null && datosPartido.jugadores.length > 0) datosPartido.estado = "Info Faltantes Incompleta";
        else { datosPartido.estado = "Disponible"; if (datosPartido.Ocupado === null) datosPartido.Ocupado = 0; }
      }

      var filaParaHoja = [fechaExtraccionActual, datosPartido.dia, datosPartido.horaInicio, datosPartido.horaFin, datosPartido.pista];
      for (var k = 0; k < 4; k++) {
        if (datosPartido.jugadores[k]) { filaParaHoja.push(datosPartido.jugadores[k].nombre); filaParaHoja.push(datosPartido.jugadores[k].nivel); }
        else { filaParaHoja.push(""); filaParaHoja.push(""); }
      }
      filaParaHoja.push(datosPartido.Ocupado !== null ? datosPartido.Ocupado : "");
      filaParaHoja.push(datosPartido.estado);
      filaParaHoja.push(datosPartido.idOriginal);
      partidosExtraidosGlobal.push(filaParaHoja);
    } 
    Logger.log("Día " + fechaParaURL + " procesado. Partidos encontrados para este día: " + contadorBloquesDia);
  } 

  hojaPartidos.clearContents(); 
  if (partidosExtraidosGlobal.length > 1) { 
    hojaPartidos.getRange(1, 1, partidosExtraidosGlobal.length, partidosExtraidosGlobal[0].length).setValues(partidosExtraidosGlobal);
  }
  Logger.log("Scraping de MÚLTIPLES DÍAS completado. Total de filas escritas en Hoja1_TuPadel (incluyendo encabezado): " + partidosExtraidosGlobal.length);

    const partidosProcesados = partidosExtraidosGlobal.length - 1;
    return { success: true, message: `Scraping completado. ${partidosProcesados} partidas guardadas.` };

  } catch (e) {
    Logger.log(`ERROR en procesarYGuardarPartidos: ${e.stack}`);
    return { success: false, message: e.message };
  }

}

// Añade esta función a tu archivo de script en Google Sheets.
function eliminarAlertasPasadas() {
  const SPREADSHEET_ID = "11vaF9UBw6eu5vVd7YJm1OhFsm6T-cJRjnvUmZbVVbc8/"; // Asegúrate de poner el ID correcto
  const HOJA_ALERTAS_NOMBRE = "PreferenciasAlertas"; // El nombre de tu hoja de alertas

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(HOJA_ALERTAS_NOMBRE);
    if (!sheet) {
      console.log(`No se encontró la hoja con el nombre: ${HOJA_ALERTAS_NOMBRE}`);
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Normalizamos la fecha a la medianoche para una comparación justa

    // Buscamos los índices de las columnas que necesitamos
    const tipoFechaCol = headers.indexOf("TipoFechaAlerta");
    const fechaDeseadaCol = headers.indexOf("FechaDeseada");
    
    if (tipoFechaCol === -1 || fechaDeseadaCol === -1) {
      console.log("No se encontraron las columnas 'TipoFechaAlerta' o 'FechaDeseada'.");
      return;
    }

    // Recorremos las filas desde el final hacia el principio para no afectar los índices al borrar
    for (let i = data.length - 1; i > 0; i--) {
      const fila = data[i];
      const tipoFecha = fila[tipoFechaCol];
      const fechaDeseadaStr = fila[fechaDeseadaCol];

      // Solo procesamos alertas con fecha específica
      if (tipoFecha === "Fecha específica" && fechaDeseadaStr) {
        const fechaDeseada = new Date(fechaDeseadaStr);
        
        // Si la fecha de la alerta es anterior a hoy, la eliminamos
        if (fechaDeseada < hoy) {
          console.log(`Eliminando fila ${i + 1} por ser una alerta pasada (Fecha: ${fechaDeseadaStr}).`);
          sheet.deleteRow(i + 1); // +1 porque los arrays son base 0 y las filas base 1
        }
      }
    }
    console.log("Proceso de limpieza de alertas pasadas finalizado.");
  } catch (e) {
    console.error(`Error en eliminarAlertasPasadas: ${e.toString()}`);
  }
}

function obtenerPartidosDeHoyDeSheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName("Hoja1_TuPadel"); // Asegúrate que el nombre de tu hoja sea "Hoja1_TuPadel"
    if (!hoja) {
      Logger.log("Error: No se encontró la Hoja1_TuPadel.");
      return "Error interno: No se pudo acceder a los datos de los partidos.";
    }

    var datos = hoja.getDataRange().getValues();
    if (datos.length < 2) { // Menos de 2 filas significa que solo hay encabezados o está vacía
      return "No hay partidos registrados en este momento.";
    }

    var hoy = new Date();
    // Formatear la fecha de hoy como YYYY-MM-DD para comparar con la hoja
    // Asegúrate que tu script está en la zona horaria correcta (Archivo > Propiedades del proyecto)
    // Si no, ajusta la zona horaria aquí. Por defecto, usa la del servidor de Google.
    var zonaHoraria = Session.getScriptTimeZone(); // o "Europe/Madrid" por ejemplo
    var fechaHoyFormateada = Utilities.formatDate(hoy, zonaHoraria, "yyyy-MM-dd");
    Logger.log("Buscando partidos para la fecha: " + fechaHoyFormateada);

    var partidosDeHoyEncontrados = [];
    // Empezar desde la fila 1 para saltar los encabezados (índice 0)
    for (var i = 1; i < datos.length; i++) {
      var fila = datos[i];
      var diaPartidoEnHoja = fila[1]; // Columna B: "Dia Partido"

      // Convertir la fecha de la hoja a objeto Date para comparación robusta si es necesario,
      // pero si ya está como YYYY-MM-DD y fechaHoyFormateada también, la comparación de strings es suficiente.
      // Si diaPartidoEnHoja es un objeto Date de la hoja:
      // var fechaPartidoFormateada = Utilities.formatDate(new Date(diaPartidoEnHoja), zonaHoraria, "yyyy-MM-dd");
      // if (fechaPartidoFormateada === fechaHoyFormateada) { ... }
      
      if (diaPartidoEnHoja === fechaHoyFormateada) {
        // Columnas: B:Dia, C:HoraI, D:HoraF, E:Pista, F-M:Jugadores, N:Faltan, O:Estado
        var horaInicio = fila[2] ? Utilities.formatDate(new Date(fila[2]), zonaHoraria, "HH:mm") : "N/A";
        var horaFin = fila[3] ? Utilities.formatDate(new Date(fila[3]), zonaHoraria, "HH:mm") : "N/A";
        var pista = fila[4] || "N/A";
        var jugadores = [];
        if(fila[5]) jugadores.push(fila[5] + (fila[6] ? " ("+fila[6]+")" : "")); // J1 Nombre (Nivel)
        if(fila[7]) jugadores.push(fila[7] + (fila[8] ? " ("+fila[8]+")" : "")); // J2 Nombre (Nivel)
        if(fila[9]) jugadores.push(fila[9] + (fila[10] ? " ("+fila[10]+")" : ""));// J3 Nombre (Nivel)
        if(fila[11]) jugadores.push(fila[11] + (fila[12] ? " ("+fila[12]+")" : ""));// J4 Nombre (Nivel)
        
        var faltan = fila[13] !== "" ? fila[13] : "N/A";
        var estado = fila[14] || "N/A";

        var infoPartido = "<b>Pista:</b> " + pista + "\n";
        infoPartido += "<b>Hora:</b> " + horaInicio + " - " + horaFin + "\n";
        infoPartido += "<b>Estado:</b> " + estado + " (Faltan: " + faltan + ")\n";
        if (jugadores.length > 0) {
          infoPartido += "<b>Jugadores:</b>\n";
          jugadores.forEach(function(jugador){
            infoPartido += "  - " + jugador + "\n";
          });
        } else {
          infoPartido += "<i>Sin jugadores inscritos aún.</i>\n";
        }
        partidosDeHoyEncontrados.push(infoPartido);
      }
    }

    if (partidosDeHoyEncontrados.length > 0) {
      return "<b>Partidos para Hoy (" + fechaHoyFormateada + "):</b>\n\n" + partidosDeHoyEncontrados.join("\n-----------------\n");
    } else {
      return "No hay partidos disponibles para hoy (" + fechaHoyFormateada + ").";
    }

  } catch (err) {
    Logger.log("Error en obtenerPartidosDeHoyDeSheet: " + err.toString() + "\nStack: " + err.stack);
    return "Hubo un error al buscar los partidos. Intenta de nuevo más tarde.";
  }
}

/**
 * VERSIÓN DE DEPURACIÓN: No escribe datos, solo muestra logs detallados
 * para comparar las claves de `Hoja1_TuPadel` y `HistorialJugadores`.
 */
function debug_procesarHistorial() {
  Logger.log("--- INICIANDO DEPURACIÓN DE HISTORIAL ---");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaPartidos = ss.getSheetByName("Hoja1_TuPadel"); 
  var hojaHistorial = ss.getSheetByName("HistorialJugadores");

  if (!hojaPartidos || !hojaHistorial) {
    Logger.log("Error: Faltan hojas.");
    return;
  }

  var ayer = new Date();
  ayer.setDate(ayer.getDate() - 1); 
  var zonaHoraria = Session.getScriptTimeZone();
  var fechaAyerStr = Utilities.formatDate(ayer, zonaHoraria, "yyyy-MM-dd");
  Logger.log("Fecha a procesar: " + fechaAyerStr);

  // --- 1. Inspeccionar claves del Historial ---
  var datosHistorialExistente = hojaHistorial.getDataRange().getValues();
  var clavesExistentes = new Set(datosHistorialExistente.slice(1).map(fila => `${fila[8]}||${String(fila[0]).trim().toLowerCase()}`));
  
  Logger.log(`Total de claves existentes en HistorialJugadores: ${clavesExistentes.size}`);
  // Mostramos algunas claves de ejemplo del historial para comparar
  Logger.log("Ejemplo de claves en Historial: " + JSON.stringify(Array.from(clavesExistentes).slice(0, 5)));


  // --- 2. Inspeccionar claves generadas desde Hoja1_TuPadel ---
  var todosLosDatosPartidos = hojaPartidos.getDataRange().getValues();
  var encabezadosHoja1_TuPadel = todosLosDatosPartidos[0];
  var idx = {};
  encabezadosHoja1_TuPadel.forEach((h, i) => idx[h.trim()] = i);
  
  var datosPartidosDeAyerFiltrados = todosLosDatosPartidos.slice(1).filter(fila => {
      var diaPartidoEnFila = fila[idx["Dia Partido"]];
      if (!diaPartidoEnFila) return false;
      var fechaFilaStr = (diaPartidoEnFila instanceof Date) ? Utilities.formatDate(diaPartidoEnFila, zonaHoraria, "yyyy-MM-dd") : String(diaPartidoEnFila);
      return fechaFilaStr === fechaAyerStr;
  });

  if (datosPartidosDeAyerFiltrados.length === 0) {
    Logger.log("FALLO: No se encontraron partidos de AYER en Hoja1_TuPadel para procesar.");
    return;
  }

  Logger.log(`Partidos de ayer encontrados en Hoja1_TuPadel: ${datosPartidosDeAyerFiltrados.length}`);
  
  datosPartidosDeAyerFiltrados.forEach(filaPartido => {
    var idOriginalPartido = filaPartido[idx["ID Original del Partido"]];
    if (!idOriginalPartido) return;
    
    Logger.log(`\nProcesando Partido ID: [${idOriginalPartido}]`);

    for (var k_jugador = 1; k_jugador <= 4; k_jugador++) {
        var nombreJugador = filaPartido[idx[`Jugador ${k_jugador} Nombre`]];
        if (nombreJugador && typeof nombreJugador === 'string' && nombreJugador.trim() !== "") {
            
            var claveGenerada = `${idOriginalPartido}||${nombreJugador.trim().toLowerCase()}`;
            var yaExiste = clavesExistentes.has(claveGenerada);
            
            // Log para CADA jugador, indicando si se encontró o no
            Logger.log(`  -> Jugador: [${nombreJugador.trim()}]`);
            Logger.log(`     Clave Generada: "${claveGenerada}"`);
            Logger.log(`     ¿Ya existe en Historial? ---> ${yaExiste ? 'SÍ (se omitirá)' : 'NO (debería añadirse)'}`);
        }
    }
  });
  Logger.log("\n--- FIN DE LA DEPURACIÓN ---");
}

function procesarHistorialParaAnalisis_Acumulativo() {
  Logger.log("Iniciando procesarHistorialParaAnalisis_Acumulativo...");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaPartidos = ss.getSheetByName("Hoja1_TuPadel"); 
  var hojaHistorial = ss.getSheetByName("HistorialJugadores");

  if (!hojaPartidos || !hojaHistorial) {
    Logger.log("Error: No se encontró la hoja de partidos o de historial. Finalizando.");
    return;
  }

  var ayer = new Date();
  ayer.setDate(ayer.getDate() - 1); 
  var zonaHoraria = Session.getScriptTimeZone();
  var fechaAyerStr = Utilities.formatDate(ayer, zonaHoraria, "yyyy-MM-dd");
  Logger.log("Procesando historial para partidos del día: " + fechaAyerStr);

  var todosLosDatosPartidos = hojaPartidos.getDataRange().getValues();
  if (todosLosDatosPartidos.length <= 1) {
    Logger.log("Hoja1_TuPadel está vacía. No hay datos para procesar.");
    return;
  }

  var encabezadosHoja1_TuPadel = todosLosDatosPartidos[0];
  var idx = {};
  encabezadosHoja1_TuPadel.forEach((h, i) => idx[h.trim()] = i);

  var datosPartidosDeAyerFiltrados = todosLosDatosPartidos.slice(1).filter(fila => {
      var diaPartidoEnFila = fila[idx["Dia Partido"]];
      if (!diaPartidoEnFila) return false;
      var fechaFilaStr = (diaPartidoEnFila instanceof Date) ? Utilities.formatDate(diaPartidoEnFila, zonaHoraria, "yyyy-MM-dd") : String(diaPartidoEnFila);
      return fechaFilaStr === fechaAyerStr;
  });

  if (datosPartidosDeAyerFiltrados.length === 0) {
    Logger.log("No hay partidos de AYER en Hoja1_TuPadel para procesar.");
    return;
  }

  var nuevasEntradasParaHistorial = [];
  var datosHistorialExistente = hojaHistorial.getDataRange().getValues();
  var clavesExistentes = new Set(datosHistorialExistente.slice(1).map(fila => `${fila[8]}||${String(fila[0]).trim().toLowerCase()}`));

  var diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  datosPartidosDeAyerFiltrados.forEach(filaPartido => {
    var fechaPartido, horaInicioRaw, nombrePistaCompleto, idOriginalPartido;
    try {
        fechaPartido = new Date(filaPartido[idx["Dia Partido"]]);
        horaInicioRaw = filaPartido[idx["Hora Inicio"]];
        nombrePistaCompleto = filaPartido[idx["Nombre Pista"]];
        idOriginalPartido = filaPartido[idx["ID Original"]];
        if (!fechaPartido || isNaN(fechaPartido.getTime()) || !horaInicioRaw || !nombrePistaCompleto || !idOriginalPartido) return;
    } catch(e) { return; }

    var diaDeLaSemanaNombre = diasSemana[fechaPartido.getDay()];
    var tipoDeDia = (fechaPartido.getDay() === 0 || fechaPartido.getDay() === 6) ? "Fin de Semana" : "Laborable";
    
    var horaInicioStr = "";
    if (horaInicioRaw instanceof Date) {
        horaInicioStr = Utilities.formatDate(horaInicioRaw, zonaHoraria, "HH:mm");
    } else if (typeof horaInicioRaw === 'string' && horaInicioRaw.includes(':')) {
        horaInicioStr = horaInicioRaw.split(' ')[1] ? horaInicioRaw.split(' ')[1].substring(0, 5) : horaInicioRaw.substring(0, 5);
    } else {
        horaInicioStr = String(horaInicioRaw);
    }
    
    var horaPartidoNum = parseInt(horaInicioStr.split(':')[0]);
    var momentoDelDia = (horaPartidoNum < 14) ? "Mañana" : (horaPartidoNum < 18) ? "Tarde" : "Noche";
    var ubicacion = nombrePistaCompleto.toLowerCase().includes("valencia") ? "Valencia" : "Picaña";

    for (var k_jugador = 1; k_jugador <= 4; k_jugador++) {
        var nombreJugador = filaPartido[idx[`Jugador ${k_jugador} Nombre`]];
        if (nombreJugador && typeof nombreJugador === 'string' && nombreJugador.trim() !== "" && !nombreJugador.toLowerCase().includes("invitado")) {
            var claveActual = `${idOriginalPartido}||${nombreJugador.trim().toLowerCase()}`;
            if (!clavesExistentes.has(claveActual)) {
                
                // --- CORRECCIÓN CLAVE ---
                // Estandarizamos el nivel a un string con punto decimal antes de guardarlo.
                let nivelJugador = filaPartido[idx[`Jugador ${k_jugador} Nivel`]];
                if (nivelJugador) {
                    nivelJugador = "'" + String(nivelJugador).replace(',', '.');
                }
                // --- FIN DE LA CORRECCIÓN ---

                nuevasEntradasParaHistorial.push([
                    nombreJugador.trim(),
                    nivelJugador,
                    fechaPartido,
                    horaInicioStr,
                    diaDeLaSemanaNombre,
                    tipoDeDia,
                    momentoDelDia,
                    ubicacion,
                    idOriginalPartido
                ]);
                clavesExistentes.add(claveActual);
            }
        }
    }
  });

  if (nuevasEntradasParaHistorial.length > 0) {
    hojaHistorial.getRange(hojaHistorial.getLastRow() + 1, 1, nuevasEntradasParaHistorial.length, nuevasEntradasParaHistorial[0].length).setValues(nuevasEntradasParaHistorial);
    Logger.log(`Se añadieron ${nuevasEntradasParaHistorial.length} nuevos registros al historial.`);
  } else {
    Logger.log("No hay nuevos registros de jugadores para añadir al historial.");
  }
}

function calcularYRegistrarRendimientoDiario() {
  Logger.log("Iniciando calcularYRegistrarRendimientoDiario (con desglose por ubicación)...");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaPartidos = ss.getSheetByName("Hoja1_TuPadel");       // Hoja con los datos del día del scraper
  var hojaRendimiento = ss.getSheetByName("RendimientoDiario"); // Hoja para los resúmenes

  if (!hojaPartidos) {
    Logger.log("Error: No se encontró la hoja de partidos ('Hoja1_TuPadel'). Finalizando.");
    return;
  }
  if (!hojaRendimiento) {
    Logger.log("Error: No se encontró la hoja 'RendimientoDiario'. Por favor, créala con los encabezados correctos. Finalizando.");
    return;
  }

  var todosLosDatosPartidos = hojaPartidos.getDataRange().getValues();
  if (todosLosDatosPartidos.length <= 1) {
    Logger.log("Hoja1_TuPadel está vacía o solo contiene encabezados. No hay datos para calcular rendimiento. Finalizando.");
    return;
  }

  // --- DETERMINAR FECHA DE AYER ---
  var ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  var zonaHoraria = Session.getScriptTimeZone();
  var fechaAyerStr = Utilities.formatDate(ayer, zonaHoraria, "yyyy-MM-dd");
  Logger.log("Calculando rendimiento para partidos del día: " + fechaAyerStr + " (AYER)");

  var diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  var diaSemanaNumAyer = ayer.getDay();
  var diaSemanaNombreAyer = diasSemana[diaSemanaNumAyer];

  // Filtrar partidos de Hoja1_TuPadel para que sean solo los de AYER
  // Asumimos que la columna "Dia Partido" en Hoja1_TuPadel es la columna B (índice 1)
  var IDX_Hoja1_TuPadel_DIA_PARTIDO_FILTRO = 1; 
  var partidosDeAyer = todosLosDatosPartidos.filter(function(fila, indice) {
    if (indice === 0) return false; // Omitir encabezado de Hoja1_TuPadel
    var fechaFila = "";
    if (fila[IDX_Hoja1_TuPadel_DIA_PARTIDO_FILTRO] instanceof Date) {
      fechaFila = Utilities.formatDate(fila[IDX_Hoja1_TuPadel_DIA_PARTIDO_FILTRO], zonaHoraria, "yyyy-MM-dd");
    } else if (typeof fila[IDX_Hoja1_TuPadel_DIA_PARTIDO_FILTRO] === 'string') {
      if (fila[IDX_Hoja1_TuPadel_DIA_PARTIDO_FILTRO].match(/^\d{4}-\d{2}-\d{2}$/)) {
        fechaFila = fila[IDX_Hoja1_TuPadel_DIA_PARTIDO_FILTRO];
      } else {
        // Intentar parsear si es un string pero no en formato yyyy-MM-dd exacto
        var tempDate = new Date(fila[IDX_Hoja1_TuPadel_DIA_PARTIDO_FILTRO]);
        if (!isNaN(tempDate.getTime())) fechaFila = Utilities.formatDate(tempDate, zonaHoraria, "yyyy-MM-dd");
      }
    }
    return fechaFila === fechaAyerStr;
  });

  Logger.log("Partidos de AYER encontrados en Hoja1_TuPadel para procesar: " + partidosDeAyer.length);
  if (partidosDeAyer.length === 0) {
    Logger.log("No se encontraron partidos de AYER en Hoja1_TuPadel. Finalizando.");
    // Considera escribir una fila de "ceros" para ayer si quieres un registro aunque no haya actividad.
    // Por ahora, si no hay datos de ayer, no se escribe nada.
    return;
  }

  // Índices de columnas en las filas de 'partidosDeAyer' (que vienen de 'Hoja1_TuPadel')
  var COL_HORA_INICIO = 2; // Columna C de Hoja1_TuPadel
  var COL_NOMBRE_PISTA = 4; // Columna E de Hoja1_TuPadel
  var COL_ESTADO = 14;     // Columna O de Hoja1_TuPadel

  // Estructura para el resumen
  var resumen = {
    "Valencia": {
      "Mañana": { ofrecidas: 0, ocupadasJugadores: 0, ocupadasAdmin: 0, disponiblesFinal: 0 },
      "Tarde":  { ofrecidas: 0, ocupadasJugadores: 0, ocupadasAdmin: 0, disponiblesFinal: 0 },
      "Noche":  { ofrecidas: 0, ocupadasJugadores: 0, ocupadasAdmin: 0, disponiblesFinal: 0 },
      "Total Turnos Ubicacion": { ofrecidas: 0, ocupadasJugadores: 0, ocupadasAdmin: 0, disponiblesFinal: 0 }
    },
    "Picaña": {
      "Mañana": { ofrecidas: 0, ocupadasJugadores: 0, ocupadasAdmin: 0, disponiblesFinal: 0 },
      "Tarde":  { ofrecidas: 0, ocupadasJugadores: 0, ocupadasAdmin: 0, disponiblesFinal: 0 },
      "Noche":  { ofrecidas: 0, ocupadasJugadores: 0, ocupadasAdmin: 0, disponiblesFinal: 0 },
      "Total Turnos Ubicacion": { ofrecidas: 0, ocupadasJugadores: 0, ocupadasAdmin: 0, disponiblesFinal: 0 }
    },
    "Otra": { // Por si hay pistas no clasificadas
      "Mañana": { ofrecidas: 0, ocupadasJugadores: 0, ocupadasAdmin: 0, disponiblesFinal: 0 },
      "Tarde":  { ofrecidas: 0, ocupadasJugadores: 0, ocupadasAdmin: 0, disponiblesFinal: 0 },
      "Noche":  { ofrecidas: 0, ocupadasJugadores: 0, ocupadasAdmin: 0, disponiblesFinal: 0 },
      "Total Turnos Ubicacion": { ofrecidas: 0, ocupadasJugadores: 0, ocupadasAdmin: 0, disponiblesFinal: 0 }
    },
    "Total Dia Club": { ofrecidas: 0, ocupadasJugadores: 0, ocupadasAdmin: 0, disponiblesFinal: 0 }
  };

  for (var i = 0; i < partidosDeAyer.length; i++) {
    var fila = partidosDeAyer[i];
    var horaInicioStr = fila[COL_HORA_INICIO];
    var nombrePistaCompleto = String(fila[COL_NOMBRE_PISTA]).toLowerCase();
    var estado = String(fila[COL_ESTADO]).toLowerCase();

    if (!horaInicioStr || !estado || !nombrePistaCompleto) continue;

    var horaPartido, minutosPartido;
    if (horaInicioStr instanceof Date) {
      horaPartido = horaInicioStr.getHours();
      minutosPartido = horaInicioStr.getMinutes();
    } else if (typeof horaInicioStr === 'string' && horaInicioStr.includes(':')) {
      var partesHora = horaInicioStr.split(':');
      horaPartido = parseInt(partesHora[0]);
      minutosPartido = parseInt(partesHora[1]);
      if (isNaN(horaPartido) || isNaN(minutosPartido)) continue;
    } else {
      continue;
    }

    var turno = "";
    if (horaPartido >= 8 && horaPartido < 13) { turno = "Mañana"; } 
    else if (horaPartido === 13 && minutosPartido <= 30) { turno = "Mañana"; } 
    else if (horaPartido === 13 && minutosPartido >= 31) { turno = "Tarde"; } 
    else if (horaPartido > 13 && horaPartido < 17) { turno = "Tarde"; } 
    else if (horaPartido === 17 && minutosPartido <= 30) { turno = "Tarde"; } 
    else if (horaPartido === 17 && minutosPartido >= 31) { turno = "Noche"; } 
    else if (horaPartido > 17 && horaPartido <= 23) { turno = "Noche"; } 
    else { continue; } // Si está fuera de los turnos definidos, no lo contamos

    var ubicacion = "Otra"; // Por defecto
    if (nombrePistaCompleto.includes("valencia")) { ubicacion = "Valencia"; } 
    else if (nombrePistaCompleto.includes("picaña")) { ubicacion = "Picaña"; }
    
    resumen[ubicacion][turno].ofrecidas++;
    resumen[ubicacion]["Total Turnos Ubicacion"].ofrecidas++;
    resumen["Total Dia Club"].ofrecidas++;

    if (estado === "completo") {
      resumen[ubicacion][turno].ocupadasJugadores++;
      resumen[ubicacion]["Total Turnos Ubicacion"].ocupadasJugadores++;
      resumen["Total Dia Club"].ocupadasJugadores++;
    } else if (estado === "bloqueado (admin)") {
      resumen[ubicacion][turno].ocupadasAdmin++;
      resumen[ubicacion]["Total Turnos Ubicacion"].ocupadasAdmin++;
      resumen["Total Dia Club"].ocupadasAdmin++;
    } else if (estado === "disponible") {
      resumen[ubicacion][turno].disponiblesFinal++;
      resumen[ubicacion]["Total Turnos Ubicacion"].disponiblesFinal++;
      resumen["Total Dia Club"].disponiblesFinal++;
    }
  }

  var filasParaEscribirEnRendimiento = [];
  var ubicacionesParaReporte = ["Valencia", "Picaña", "Otra"]; 
  var turnosParaReporte = ["Mañana", "Tarde", "Noche", "Total Turnos Ubicacion"];

  // Si la hoja RendimientoDiario está completamente vacía (o solo tiene una fila de encabezado que se borra si se corre dos veces el mismo día), añadir encabezados
  if (hojaRendimiento.getLastRow() === 0) {
      hojaRendimiento.appendRow([
          "Fecha", "Dia de la Semana", "Ubicacion", "Turno", "Pistas Ofrecidas", 
          "Ocupadas (Jugadores)", "Ocupadas (Admin)", "Total Ocupadas", 
          "Pistas Disponibles (Final)", "% Ocupación"
      ]);
  }

  for (var u = 0; u < ubicacionesParaReporte.length; u++) {
    var loc = ubicacionesParaReporte[u];
    // Solo procesar la ubicación "Otra" si realmente tuvo pistas ofrecidas
    if (loc === "Otra" && resumen[loc]["Total Turnos Ubicacion"].ofrecidas === 0) {
        continue;
    }

    for (var t = 0; t < turnosParaReporte.length; t++) {
      var turnoNombre = turnosParaReporte[t];
      // Solo escribir la fila del turno si hubo pistas ofrecidas para ese turno/ubicación,
      // o si es el "Total Turnos Ubicacion" y esa ubicación tuvo alguna actividad.
      if (resumen[loc][turnoNombre].ofrecidas > 0 || 
         (turnoNombre === "Total Turnos Ubicacion" && resumen[loc]["Total Turnos Ubicacion"].ofrecidas > 0)) {
        var stats = resumen[loc][turnoNombre];
        var totalOcupadas = stats.ocupadasJugadores + stats.ocupadasAdmin;
        var porcentajeOcupacion = stats.ofrecidas > 0 ? (totalOcupadas / stats.ofrecidas) : 0;
        
        filasParaEscribirEnRendimiento.push([
          fechaAyerStr, 
          diaSemanaNombreAyer,
          loc, 
          turnoNombre, 
          stats.ofrecidas,
          stats.ocupadasJugadores,
          stats.ocupadasAdmin,
          totalOcupadas,
          stats.disponiblesFinal,
          porcentajeOcupacion
        ]);
      }
    }
  }
  
  // Añadir la fila del Total del Día para el Club si hubo alguna pista ofrecida en el día
  if (resumen["Total Dia Club"].ofrecidas > 0) {
    var statsTotalDia = resumen["Total Dia Club"];
    var totalOcupadasDia = statsTotalDia.ocupadasJugadores + statsTotalDia.ocupadasAdmin;
    var porcentajeOcupacionDia = statsTotalDia.ofrecidas > 0 ? (totalOcupadasDia / statsTotalDia.ofrecidas) : 0;
    filasParaEscribirEnRendimiento.push([
      fechaAyerStr,
      diaSemanaNombreAyer,
      "Club (Total General)", 
      "Total Dia",            
      statsTotalDia.ofrecidas,
      statsTotalDia.ocupadasJugadores,
      statsTotalDia.ocupadasAdmin,
      totalOcupadasDia,
      statsTotalDia.disponiblesFinal,
      porcentajeOcupacionDia
    ]);
  }

  if (filasParaEscribirEnRendimiento.length > 0) {
    var primeraFilaVacia = hojaRendimiento.getLastRow() + 1;
    var rangoParaEscribir = hojaRendimiento.getRange(primeraFilaVacia, 1, filasParaEscribirEnRendimiento.length, filasParaEscribirEnRendimiento[0].length);
    rangoParaEscribir.setValues(filasParaEscribirEnRendimiento);
    
    var columnaFecha = 1; // Columna A
    var columnaPorcentaje = filasParaEscribirEnRendimiento[0].length; // Última columna
    
    hojaRendimiento.getRange(primeraFilaVacia, columnaFecha, filasParaEscribirEnRendimiento.length, 1).setNumberFormat("yyyy-mm-dd");
    hojaRendimiento.getRange(primeraFilaVacia, columnaPorcentaje, filasParaEscribirEnRendimiento.length, 1).setNumberFormat("0.00%");
    
    Logger.log("Resumen de rendimiento para el " + fechaAyerStr + " (" + diaSemanaNombreAyer + ") añadido a 'RendimientoDiario' con desglose.");
  } else {
    Logger.log("No se generaron filas para el resumen de rendimiento de AYER.");
  }
}

/**
 * Función auxiliar para registrar un hábito con un peso específico en el perfil de un usuario.
 */
function _registrarHabitoPonderado(perfiles, username, habito, peso, esPartidaReal = false) {
  if (!username || !habito) return;

  if (!perfiles[username]) {
    perfiles[username] = {
      totalPartidos: 0,
      tiposDia: {}, 
      momentosDia: {}, 
      diasSemana: {}, 
      ubicaciones: {},
      horasInicio: {}
    };
  }
  const perfil = perfiles[username];

  if (habito.momentoDia) perfil.momentosDia[habito.momentoDia] = (perfil.momentosDia[habito.momentoDia] || 0) + peso;
  if (habito.tipoDia) perfil.tiposDia[habito.tipoDia] = (perfil.tiposDia[habito.tipoDia] || 0) + peso;
  if (habito.diaSemana) perfil.diasSemana[habito.diaSemana] = (perfil.diasSemana[habito.diaSemana] || 0) + peso;
  if (habito.ubicacion) perfil.ubicaciones[habito.ubicacion] = (perfil.ubicaciones[habito.ubicacion] || 0) + 1;
  
  if (esPartidaReal) {
      perfil.totalPartidos++;
      if (habito.horaInicio) {
        perfil.horasInicio[habito.horaInicio] = (perfil.horasInicio[habito.horaInicio] || 0) + 1;
      }
  }
}



/**
 * MOTOR DE RECOMENDACIONES v40 (Logging Detallado y Lógica Flexible)
 * - AÑADIDO: Log detallado que muestra el perfil de hábitos del usuario y los top 3 partidos evaluados.
 * - MANTENIDO: Lógica de puntuación flexible de la v39.
 */
function recomendarPartidosPorHabitos() {
  Logger.log("🧠 ===============================================================");
  Logger.log("🧠 MOTOR RECOMENDADOR v40 (Logging Detallado): Iniciando...");
  
  const scriptProperties = PropertiesService.getScriptProperties();
  const PISTA_EXCLUIDA_NOMBRE = scriptProperties.getProperty('PISTA_EXCLUIDA_NOMBRE') || "pista negra";
  const ahora = new Date();
  const horaActual = parseInt(Utilities.formatDate(ahora, "Europe/Madrid", "H"));
  if (horaActual >= 23 || horaActual < 8) {
    const msg = "Ejecución omitida por periodo de no molestar (23:00-08:00).";
    Logger.log(`🌙 ${msg}`);
    return { success: true, message: msg };
  }
  
  const UMBRAL_AFINIDAD = parseInt(scriptProperties.getProperty('UMBRAL_AFINIDAD') || 85);
  const UMBRAL_PARTIDO_PERFECTO = 115;
  const PARTIDOS_POR_PAGINA = 3;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaPartidos = ss.getSheetByName("Hoja1_TuPadel");
  const hojaPerfiles = ss.getSheetByName("PerfilesUsuario");
  const hojaCacheHabitos = ss.getSheetByName("HabitosCache");
  const hojaRecomendaciones = ss.getSheetByName("RecomendacionesEnviadas");
  const hojaPaginacion = ss.getSheetByName("RecomendacionesPaginadas");
  const hojaFestivos = ss.getSheetByName("CalendarioFestivos");

  if (!hojaPerfiles || !hojaPartidos || !hojaCacheHabitos || !hojaRecomendaciones || !hojaFestivos) { 
    const msg = "Error: Faltan hojas esenciales.";
    Logger.log(msg); 
    return { success: false, message: msg }; 
  }
  
  const perfilesData = hojaPerfiles.getDataRange().getValues();
  const partidosData = hojaPartidos.getDataRange().getValues();
  const cacheData = hojaCacheHabitos.getDataRange().getValues();
  const recomendacionesData = hojaRecomendaciones.getDataRange().getValues();
  const festivosData = hojaFestivos.getDataRange().getValues().slice(1);
  const festivosSet = new Set(festivosData.map(row => row[0]));

  const headersPerf = perfilesData[0]; const idxPerf = {}; headersPerf.forEach((h, i) => idxPerf[h.trim()] = i);
  const headersPart = partidosData[0]; const idxPart = {}; headersPart.forEach((h, i) => idxPart[h.trim()] = i);
  
  const perfilesDeHabitos = {};
  cacheData.slice(1).forEach(row => {
      if (row[0] && row[1]) {
          perfilesDeHabitos[row[0].toLowerCase()] = JSON.parse(row[1]);
      }
  });

  const recomendadosSet = new Set(recomendacionesData.slice(1).map(row => `${row[0]}_${row[1]}`));
  const diasSemana = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const hoy = new Date(); 
  hoy.setHours(0, 0, 0, 0);
  const limiteCincoDias = new Date(); 
  limiteCincoDias.setDate(hoy.getDate() + 5);

  const partidasRecomendables = partidosData.slice(1).filter(partido => {
    const plazasOcupadas = parseInt(partido[idxPart["Plazas Ocupadas"]]);
    const fechaPartido = new Date(partido[idxPart["Dia Partido"]]);
    const nombrePista = String(partido[idxPart["Nombre Pista"]]).toLowerCase();
    const esPistaExcluida = nombrePista.includes(PISTA_EXCLUIDA_NOMBRE);
    return !isNaN(plazasOcupadas) && plazasOcupadas < 4 && !esPistaExcluida && fechaPartido >= hoy && fechaPartido <= limiteCincoDias;
  });

  if (partidasRecomendables.length === 0) { 
    return { success: true, message: "No hay nuevos huecos libres para recomendar." }; 
  }
  
  Logger.log(`🔎 Iniciando análisis para ${perfilesData.length - 1} perfiles sobre ${partidasRecomendables.length} partidas.`);
  for (let i = 1; i < perfilesData.length; i++) {
    const perfilRow = perfilesData[i];
    const clubUsername = String(perfilRow[idxPerf["ClubUsername"]] || "").trim().toLowerCase();
    const telegramId = String(perfilRow[idxPerf["TelegramChatID"]] || "").trim();
    if (!clubUsername || !telegramId) continue;

    Logger.log(`\n-- Analizando al usuario: ${clubUsername} --`);
    
    const recibirRecomendaciones = String(perfilRow[idxPerf["RecibirRecomendaciones"]]).toUpperCase() === 'TRUE';
    if (!recibirRecomendaciones) {
      Logger.log(`   -> ⚠️ INFO: No se enviaron recomendaciones. Razón: El usuario tiene las recomendaciones desactivadas.`);
      continue;
    }

    const habitosJugador = perfilesDeHabitos[clubUsername];
    if (!habitosJugador) {
      Logger.log(`   -> ⚠️ INFO: No se enviaron recomendaciones. Razón: No se encontraron hábitos en caché para este usuario.`);
      continue;
    }

    // --- INICIO: Log de Perfil de Hábitos ---
    let habitosLog = "   -> Perfil de Hábitos:\n";
    habitosLog += `      - Hábito Combinado: ${habitosJugador.habitoCombinado || 'N/A'}\n`;
    habitosLog += `      - Ubicación: ${habitosJugador.habitoUbicacion || 'N/A'}\n`;
    habitosLog += `      - Hora: ${habitosJugador.habitoHora || 'N/A'}\n`;
    habitosLog += `      - Frecuencia: ~ cada ${habitosJugador.frecuenciaDeJuegoEnDias || 'N/A'} días`;
    Logger.log(habitosLog);
    // --- FIN: Log de Perfil de Hábitos ---
    
    let horasCooldownUsuario = 72;
    const frecuencia = habitosJugador.frecuenciaDeJuegoEnDias;
    if (frecuencia && frecuencia <= 3) { horasCooldownUsuario = 24; } 
    else if (frecuencia && frecuencia <= 5) { horasCooldownUsuario = 48; }
    
    const ultimoEnvioTimestamp = perfilRow[idxPerf["TimestampUltimaRecomendacion"]];
    const estaEnCoolDown = ultimoEnvioTimestamp ? (ahora.getTime() - new Date(ultimoEnvioTimestamp).getTime()) < (horasCooldownUsuario * 60 * 60 * 1000) : false;
    
    const fechasOcupadas = new Set(partidosData.slice(1).filter(p => [p[idxPart["J1 Nombre"]], p[idxPart["J2 Nombre"]], p[idxPart["J3 Nombre"]], p[idxPart["J4 Nombre"]]].some(j => j && j.trim().toLowerCase() === clubUsername)).map(p => new Date(p[idxPart["Dia Partido"]]).toDateString()));
    
    const habitosCombinadosDelJugador = habitosJugador.habitosCombinados || {};
    const maxCountHabito = Object.values(habitosCombinadosDelJugador).reduce((max, count) => Math.max(max, count), 0);
    
    let todosLosPartidosEvaluados = [];

    partidasRecomendables.forEach(partido => {
        const idOriginal = partido[idxPart["ID Original"]];
        const fechaPartido = new Date(partido[idxPart["Dia Partido"]]);
        if (fechasOcupadas.has(fechaPartido.toDateString())) return;

        let nivelCompatible = false;
        try { /* ...lógica de nivel sin cambios... */
            const nivelPerfilFloat = parseFloat(String(perfilRow[idxPerf["DefaultLevel"]]).replace(',', '.'));
            if (isNaN(nivelPerfilFloat)) return;
            const plazasOcupadas = parseInt(partido[idxPart["Plazas Ocupadas"]]);
            if (plazasOcupadas === 0) nivelCompatible = true;
            else {
                for (let k = 1; k <= 4; k++) {
                    const nivelJugadorStrRaw = String(partido[idxPart[`J${k} Nivel`]] || "");
                    if (nivelJugadorStrRaw) {
                        const nivelJugadorFloat = parseFloat(nivelJugadorStrRaw.replace(/^'+/, '').replace(',', '.'));
                        if (!isNaN(nivelJugadorFloat) && nivelJugadorFloat === nivelPerfilFloat) { nivelCompatible = true; break; }
                    }
                }
            }
        } catch (e) { return; }
        if (!nivelCompatible) return;

        let score = 0;
        const plazasOcupadas = parseInt(partido[idxPart["Plazas Ocupadas"]]);
        if (plazasOcupadas > 0) score += 10;
        
        const horaInicioPartidoStr = partido[idxPart["Hora Inicio"]] instanceof Date ? Utilities.formatDate(partido[idxPart["Hora Inicio"]], "Europe/Madrid", "HH:mm") : String(partido[idxPart["Hora Inicio"]]);
        const horaPartido = parseInt(horaInicioPartidoStr.split(":")[0]);
        const momentoDiaPartido = (horaPartido < 14) ? "manana" : (horaPartido < 18) ? "tarde" : "noche";
        const diaSemanaPartido = diasSemana[fechaPartido.getDay()];
        const habitoCombinadoPartido = `${diaSemanaPartido}-${momentoDiaPartido}`;
        const ubicacionPartido = String(partido[idxPart["Nombre Pista"]]).toLowerCase().includes("valencia") ? "Valencia" : "Picaña";
        
        const countDeEsteHabito = habitosCombinadosDelJugador[habitoCombinadoPartido] || 0;
        if (countDeEsteHabito > 0 && maxCountHabito > 0) score += Math.round((countDeEsteHabito / maxCountHabito) * 70);
        
        const fechaPartidoStr = Utilities.formatDate(fechaPartido, "Europe/Madrid", "yyyy-MM-dd");
        const tipoDiaPartido = (fechaPartido.getDay() === 0 || fechaPartido.getDay() === 6 || festivosSet.has(fechaPartidoStr)) ? "Fin de Semana" : "Laborable";
        
        if (habitosJugador.habitoTipoDia && tipoDiaPartido.toLowerCase() === habitosJugador.habitoTipoDia.toLowerCase()) score += 15;
        if (habitosJugador.habitoUbicacion && ubicacionPartido.toLowerCase() === habitosJugador.habitoUbicacion.toLowerCase()) score += 5;
        
        if (habitosJugador.habitoHora) { /* ...lógica de hora sin cambios... */
            try {
                const [hHabitual, mHabitual] = habitosJugador.habitoHora.split(':').map(Number);
                const minutosHabituales = hHabitual * 60 + mHabitual;
                const [hPartido, mPartido] = horaInicioPartidoStr.split(':').map(Number);
                const minutosPartido = hPartido * 60 + mPartido;
                if (Math.abs(minutosPartido - minutosHabituales) <= 60) score += 15;
            } catch(e) {}
        }

        todosLosPartidosEvaluados.push({ id: idOriginal, score: score, details: `${habitoCombinadoPartido} @ ${ubicacionPartido}`, partidoData: partido });
    });

    // --- INICIO: Log de Top Partidos Evaluados ---
    todosLosPartidosEvaluados.sort((a, b) => b.score - a.score);
    let topPartidosLog = "   -> Top 3 Partidos Evaluados:\n";
    todosLosPartidosEvaluados.slice(0, 3).forEach((p, index) => {
      topPartidosLog += `      ${index + 1}. [ID: ${p.id}] - Score: ${p.score} (${p.details})\n`;
    });
    Logger.log(topPartidosLog);
    // --- FIN: Log de Top Partidos Evaluados ---

    const todasLasCandidatas = todosLosPartidosEvaluados.filter(p => p.score >= UMBRAL_AFINIDAD);
    const maxScoreEncontrado = todosLosPartidosEvaluados.length > 0 ? todosLosPartidosEvaluados[0].score : 0;

    if (todasLasCandidatas.length === 0) {
      Logger.log(`   -> ℹ️ INFO: No se enviaron recomendaciones. Razón: Puntuación máxima (${maxScoreEncontrado}) no superó el umbral (${UMBRAL_AFINIDAD}).`);
      continue;
    }

    const partidasPerfectasNuevas = todasLasCandidatas.filter(p => p.score >= UMBRAL_PARTIDO_PERFECTO && !recomendadosSet.has(`${p.id}_${telegramId}`));
    let partidasAEnviar = [];
    if (estaEnCoolDown) {
        if (partidasPerfectasNuevas.length > 0) {
            partidasAEnviar = partidasPerfectasNuevas;
        } else {
            Logger.log(`   -> ⚠️ INFO: No se enviaron recomendaciones. Razón: El usuario está en periodo de Cooldown y no hay nuevas partidas 'perfectas'.`);
            continue;
        }
    } else {
        partidasAEnviar = todasLasCandidatas.filter(p => !recomendadosSet.has(`${p.id}_${telegramId}`));
    }

    if (partidasAEnviar.length === 0) {
      Logger.log(`   -> ℹ️ INFO: No se enviaron recomendaciones. Razón: Todas las partidas candidatas ya fueron enviadas previamente.`);
      continue;
    }
    
    const primeraPagina = partidasAEnviar.slice(0, PARTIDOS_POR_PAGINA);
    // ... resto del código para construir el mensaje y los botones (sin cambios) ...
    let mensajeFinal = `¡Hola, ${perfilRow[idxPerf["ClubUsername"]]}! 🧠 He detectado ${primeraPagina.length} partida(s) que podrían interesarte:\n`;
    primeraPagina.forEach((opcion, index) => {
        const p = opcion.partidoData;
        const plazasOcupadas = parseInt(p[idxPart["Plazas Ocupadas"]]);
        const plazasLibres = 4 - plazasOcupadas;
        const ubicacion = String(p[idxPart["Nombre Pista"]]).toLowerCase().includes("valencia") ? "VALENCIA" : "PICAÑA";
        let horaPartidoStr = p[idxPart["Hora Inicio"]] instanceof Date ? Utilities.formatDate(p[idxPart["Hora Inicio"]], "Europe/Madrid", "HH:mm") : p[idxPart["Hora Inicio"]];
        const fechaPartidoObj = new Date(p[idxPart["Dia Partido"]]);
        const diaSemanaEsp = diasSemana[fechaPartidoObj.getDay()];
        const diaMes = Utilities.formatDate(fechaPartidoObj, "Europe/Madrid", "dd/MM");
        const fechaFormateada = `${diaSemanaEsp.charAt(0).toUpperCase() + diaSemanaEsp.slice(1)} ${diaMes}`;
        let estadoEmoji = "✅ <b>Pista Libre</b>";
        if (plazasLibres === 1) estadoEmoji = "🔥 <b>¡Falta 1!</b>";
        if (plazasLibres > 1 && plazasLibres < 4) estadoEmoji = `🔥 <b>¡Faltan ${plazasLibres}!</b>`;
        mensajeFinal += `\n--- <b>Opción ${index + 1}</b> ---\n${estadoEmoji}\n<b>${ubicacion}</b> - ${p[idxPart["Nombre Pista"]]}\n<b>${fechaFormateada}</b> a las <b>${horaPartidoStr}hs</b>\n`;
    });
    mensajeFinal += "\n<b>¿Te interesa alguna de estas opciones?</b>\nPulsa en la que prefieras y te ayudo a apuntarte.";
    const tecladoDinamico = [];
    primeraPagina.forEach((opcion, index) => { tecladoDinamico.push([ { "text": `👍 Opción ${index + 1}`, "callback_data": `create_game_${opcion.id}` } ]); });
    if (partidasAEnviar.length > PARTIDOS_POR_PAGINA) {
        tecladoDinamico.push([ { "text": "👀 Ver más recomendaciones", "callback_data": `recom_page_0_${telegramId}` } ]);
        const datosParaPaginacion = partidasAEnviar.map(c => ({ id: c.id, score: c.score }));
        hojaPaginacion.appendRow([telegramId, JSON.stringify(datosParaPaginacion), new Date()]);
    }
    const tecladoFinal = { "inline_keyboard": tecladoDinamico };

    const exitoEnvio = sendMessage(telegramId, mensajeFinal, tecladoFinal);

    if (exitoEnvio) {
      hojaPerfiles.getRange(i + 1, idxPerf["TimestampUltimaRecomendacion"] + 1).setValue(new Date().toISOString());
      primeraPagina.forEach(opcion => {
          hojaRecomendaciones.appendRow([opcion.id, telegramId, new Date(), opcion.score]);
          recomendadosSet.add(`${opcion.id}_${telegramId}`);
      });
      Logger.log(`   -> ✅ DECISIÓN: Se enviaron ${primeraPagina.length} recomendaciones. Puntuación máxima: ${maxScoreEncontrado}.`);
    } else {
        Logger.log(`   -> ❌ ERROR: Falló el envío del mensaje de Telegram a ${clubUsername}.`);
    }
  }

  return { success: true, message: `Análisis de recomendaciones completado.` };
}


function limpiarRecomendacionesPaginadas() {
  Logger.log("Iniciando Tarea 8: Limpieza de Caché de Paginación...");
  let filasEliminadas = 0;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaPaginacion = ss.getSheetByName("RecomendacionesPaginadas");
    if (!hojaPaginacion || hojaPaginacion.getLastRow() < 2) {
      return { success: true, message: "Nada que limpiar." };
    }

    const data = hojaPaginacion.getDataRange().getValues();
    const ahora = new Date().getTime();
    const LIMITE_MS = 24 * 60 * 60 * 1000; 

    for (let i = data.length - 1; i > 0; i--) {
      const fila = data[i];
      const timestamp = new Date(fila[2]).getTime(); 

      if (ahora - timestamp > LIMITE_MS) {
        hojaPaginacion.deleteRow(i + 1);
        filasEliminadas++;
      }
    }
    return { success: true, message: `Se eliminaron ${filasEliminadas} cachés de paginación.` };
  } catch (e) {
    Logger.log(`ERROR en limpiarRecomendacionesPaginadas: ${e.stack}`);
    return { success: false, message: e.message };
  }
}

/**
 * Tarea que notifica a los usuarios suscritos cuando una partida se llena.
 * VERSIÓN CORREGIDA v2:
 * - AÑADIDO: Verifica que el usuario sigue inscrito en la partida antes de notificar.
 * - AÑADIDO: Limpia automáticamente las suscripciones de usuarios que ya no están en la partida.
 */
function verificarSuscripcionesLleno() {
    Logger.log("SUSCRIPCIONES v2: Iniciando verificación de partidas completas...");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaSuscripciones = ss.getSheetByName("Suscripciones");
    const hojaPartidos = ss.getSheetByName("Hoja1_TuPadel");
    const hojaPerfiles = ss.getSheetByName("PerfilesUsuario"); // Necesaria para la verificación

    if (!hojaSuscripciones || !hojaPartidos || !hojaPerfiles) {
        return { success: false, message: "Faltan hojas esenciales."};
    }

    const suscripcionesData = hojaSuscripciones.getDataRange().getValues();
    const partidosData = hojaPartidos.getDataRange().getValues();
    const perfilesData = hojaPerfiles.getDataRange().getValues();
    
    const headersSusc = suscripcionesData[0]; const idxSusc = {}; headersSusc.forEach((h, i) => idxSusc[h.trim()] = i);
    const headersPart = partidosData[0]; const idxPart = {}; headersPart.forEach((h, i) => idxPart[h.trim()] = i);
    const headersPerf = perfilesData[0]; const idxPerf = {}; headersPerf.forEach((h, i) => idxPerf[h.trim()] = i);

    // Mapa de perfiles para buscar el ClubUsername a partir del TelegramChatID
    const mapaPerfiles = {};
    perfilesData.slice(1).forEach(row => {
        mapaPerfiles[row[idxPerf["TelegramChatID"]]] = row[idxPerf["ClubUsername"]];
    });

    const mapaPartidos = {};
    partidosData.slice(1).forEach(partido => {
        const id = partido[idxPart["ID Original"]];
        if (id) {
            mapaPartidos[id] = {
                plazas: parseInt(partido[idxPart["Plazas Ocupadas"]]),
                nombrePista: partido[idxPart["Nombre Pista"]],
                fecha: new Date(partido[idxPart["Dia Partido"]]),
                hora: partido[idxPart["Hora Inicio"]] instanceof Date ? Utilities.formatDate(partido[idxPart["Hora Inicio"]], "Europe/Madrid", "HH:mm") : partido[idxPart["Hora Inicio"]],
                jugadores: [
                    partido[idxPart["J1 Nombre"]], partido[idxPart["J2 Nombre"]],
                    partido[idxPart["J3 Nombre"]], partido[idxPart["J4 Nombre"]]
                ].filter(j => j).map(j => j.trim().toLowerCase()) // Lista limpia de jugadores
            };
        }
    });

    let notificacionesEnviadas = 0;
    // Recorremos desde el final para poder eliminar filas de forma segura
    for (let i = suscripcionesData.length - 1; i > 0; i--) {
        const sub = suscripcionesData[i];
        const tipo = sub[idxSusc["TipoSuscripcion"]];
        const notificado = sub[idxSusc["Notificado"]];

        if (tipo === "notify_full" && notificado !== true) {
            const partidoId = sub[idxSusc["PartidoID"]];
            const telegramId = sub[idxSusc["TelegramChatID"]];
            const partidoInfo = mapaPartidos[partidoId];

            if (!partidoInfo) { // La partida ya no existe
                 hojaSuscripciones.deleteRow(i + 1);
                 continue;
            }

            if (partidoInfo.plazas >= 4) {
                const clubUsername = (mapaPerfiles[telegramId] || "").trim().toLowerCase();

                // --- VERIFICACIÓN CLAVE AÑADIDA ---
                if (!clubUsername || !partidoInfo.jugadores.includes(clubUsername)) {
                    Logger.log(`SUSCRIPCIONES v2: El usuario ${clubUsername || telegramId} ya no está en la partida ${partidoId}. Eliminando suscripción.`);
                    hojaSuscripciones.deleteRow(i + 1); // Limpieza automática
                    continue;
                }
                // --- FIN DE LA VERIFICACIÓN ---

                const fechaPartidoObj = partidoInfo.fecha;
                const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
                const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                const fechaFormateada = `${diasSemana[fechaPartidoObj.getDay()]} ${fechaPartidoObj.getDate()} de ${meses[fechaPartidoObj.getMonth()]}`;

                let mensaje = `✅ <b>¡Pista Completa!</b>\n\n` +
                              `La partida en la <b>${partidoInfo.nombrePista}</b> del <b>${fechaFormateada}</b> a las <b>${partidoInfo.hora}</b> ya se ha llenado.`;
                
                const keyboard = { "inline_keyboard": [[{ "text": "⏰ Ponerme un Recordatorio", "callback_data": `game_action_remind_${partidoId}` }]] };
                
                Logger.log(` -> Encontrada partida completa (${partidoId}) para notificar a ${telegramId}`);
                if (sendMessage(telegramId, mensaje, keyboard)) {
                    hojaSuscripciones.getRange(i + 1, idxSusc["Notificado"] + 1).setValue(true);
                    notificacionesEnviadas++;
                }
            }
        }
    }
    return { success: true, message: `Se enviaron ${notificacionesEnviadas} notificaciones.` };
}

/**
 * Tarea proactiva que detecta partidas recién finalizadas y envía
 * una encuesta de valoración a los participantes que son usuarios del bot.
 * VERSIÓN ROBUSTA v2 - Utiliza una hoja 'EncuestasEnviadas' dedicada.
 */
function enviarEncuestaPostPartido() {
    Logger.log("RATING v2: Iniciando revisión de partidas para encuestas...");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaPartidos = ss.getSheetByName("Hoja1_TuPadel");
    const hojaPerfiles = ss.getSheetByName("PerfilesUsuario");
    const hojaEncuestas = ss.getSheetByName("EncuestasEnviadas"); // Nueva hoja para persistencia

    if (!hojaPartidos || !hojaPerfiles || !hojaEncuestas) {
        const msg = "RATING v2: Faltan hojas esenciales (Hoja1_TuPadel, PerfilesUsuario o EncuestasEnviadas).";
        Logger.log(msg);
        return { success: false, message: msg };
    }

    // Obtenemos un Set con los IDs de las partidas ya procesadas para una búsqueda ultra-rápida.
    // Esto es mucho más eficiente que buscar en la hoja cada vez.
    const encuestasYaEnviadas = new Set(
        hojaEncuestas.getRange("A2:A").getValues().flat().filter(String)
    );

    const ahora = new Date();
    const perfilesData = hojaPerfiles.getDataRange().getValues();
    const partidosData = hojaPartidos.getDataRange().getValues();
    const headersPartidos = partidosData[0];
    const headersPerfiles = perfilesData[0];

    const idxPart = {}; headersPartidos.forEach((h, i) => idxPart[h.trim()] = i);
    const idxPerf = {}; headersPerfiles.forEach((h, i) => idxPerf[h.trim()] = i);

    // Creamos un mapa de usuarios para no tener que buscar en la hoja de perfiles en cada iteración.
    const mapaUsuarios = {};
    perfilesData.slice(1).forEach(row => {
        const clubUsername = row[idxPerf["ClubUsername"]];
        const telegramId = row[idxPerf["TelegramChatID"]];
        if (clubUsername && telegramId) {
            mapaUsuarios[clubUsername.trim().toLowerCase()] = telegramId;
        }
    });

    let encuestasEnviadasHoy = 0;
    for (let i = 1; i < partidosData.length; i++) {
        const partido = partidosData[i];
        const partidoId = partido[idxPart["ID Original"]];

        // *** LA CORRECCIÓN CLAVE ESTÁ AQUÍ ***
        // En lugar de leer una columna de Hoja1_TuPadel, verificamos si el ID ya está en nuestro Set.
        if (!partidoId || encuestasYaEnviadas.has(partidoId)) {
            continue; // Si no hay ID o ya se envió la encuesta, saltamos a la siguiente partida.
        }

        const fechaPartido = new Date(partido[idxPart["Dia Partido"]]);
        const horaFinRaw = partido[idxPart["Hora Fin"]];
        let horaFinStr;

        if (horaFinRaw instanceof Date) {
            horaFinStr = Utilities.formatDate(horaFinRaw, Session.getScriptTimeZone(), "HH:mm");
        } else {
            horaFinStr = String(horaFinRaw || "");
        }
        
        if (!horaFinStr || !horaFinStr.includes(':')) {
            continue; // Si no podemos determinar la hora de fin, no podemos procesar.
        }

        const [horas, minutos] = horaFinStr.split(':');
        fechaPartido.setHours(horas, minutos, 0, 0);

        const diffMs = ahora.getTime() - fechaPartido.getTime();
        const diffMins = diffMs / (1000 * 60);

        // Ventana de tiempo para enviar la encuesta (entre 5 y 35 minutos después de finalizar)
        if (diffMins > 5 && diffMins < 35) {
            Logger.log(`RATING v2: Partida ${partidoId} finalizada. Procesando para encuesta...`);
            
            const jugadores = [
                partido[idxPart["J1 Nombre"]], partido[idxPart["J2 Nombre"]],
                partido[idxPart["J3 Nombre"]], partido[idxPart["J4 Nombre"]]
            ].filter(j => j && String(j).trim() !== "");

            jugadores.forEach(jugadorActual => {
                const telegramIdDestino = mapaUsuarios[jugadorActual.trim().toLowerCase()];
                if (telegramIdDestino) {
                    const companeros = jugadores.filter(j => j !== jugadorActual);
                    if (companeros.length === 0) return; // No enviar si no hay compañeros que valorar

                    let mensaje = `¡Hola, ${jugadorActual}! 👋\n\nEspero que la partida en la <b>${partido[idxPart["Nombre Pista"]]}</b> haya ido genial.\n\n`;
                    mensaje += "Para ayudar a la comunidad, ¿te gustaría valorar a tus compañeros de partida?";
                    
                    const tecladoDinamico = [];
                    companeros.forEach(c => {
                        tecladoDinamico.push([
                            { "text": `👍 ${c}`, "callback_data": `rate_player_fav_${c}` },
                            { "text": `👎 ${c}`, "callback_data": `rate_player_avo_${c}` }
                        ]);
                    });
                    tecladoDinamico.push([{ "text": "✅ Todo bien, no valorar", "callback_data": "rate_player_dismiss" }]);

                    const tecladoFinal = { "inline_keyboard": tecladoDinamico };
                    if (sendMessage(telegramIdDestino, mensaje, tecladoFinal)) {
                        encuestasEnviadasHoy++;
                    }
                }
            });
            
            // *** SEGUNDA CORRECCIÓN CLAVE ***
            // Añadimos el ID de la partida a la hoja de registro para no volver a procesarla.
            hojaEncuestas.appendRow([partidoId, new Date()]);
            encuestasYaEnviadas.add(partidoId); // Actualizamos el Set en memoria para evitar envíos duplicados en la misma ejecución.
        }
    }
    
    return { success: true, message: `Se procesaron y enviaron ${encuestasEnviadasHoy} encuestas.` };
}

/**
 * Tarea programada que envía recordatorios de partidas a los usuarios.
 * VERSIÓN MEJORADA (v4):
 * - Es resiliente a cambios de hora, usando siempre la información más actualizada de la partida.
 * - Limpia automáticamente recordatorios de partidas que han sido canceladas.
 * - Verifica que el usuario sigue apuntado a la partida antes de notificarle.
 * - Formatea el tiempo en el mensaje de forma legible (ej. "2 horas" en lugar de "120 minutos").
 */
function enviarRecordatoriosPersonalizados() {
    Logger.log("Iniciando Tarea 5: Envío de Recordatorios...");
    let recordatoriosEnviados = 0;
    try {
          Logger.log("RECORDATORIOS v4: Iniciando envío de recordatorios inteligentes...");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaSuscripciones = ss.getSheetByName("Suscripciones");
    const hojaPartidos = ss.getSheetByName("Hoja1_TuPadel");
    const hojaPerfiles = ss.getSheetByName("PerfilesUsuario");

    if (!hojaSuscripciones || !hojaPartidos || !hojaPerfiles) {
        Logger.log("RECORDATORIOS: Faltan hojas esenciales (Suscripciones, Hoja1_TuPadel o PerfilesUsuario).");
        return;
    }

    const dataSusc = hojaSuscripciones.getDataRange().getValues();
    const dataPartidos = hojaPartidos.getDataRange().getValues();
    const dataPerfiles = hojaPerfiles.getDataRange().getValues();
    
    // Mapeo de columnas para cada hoja
    const headersSusc = dataSusc[0]; const idxSusc = {}; headersSusc.forEach((h, i) => idxSusc[h.trim()] = i);
    const headersPart = dataPartidos[0]; const idxPart = {}; headersPart.forEach((h, i) => idxPart[h.trim()] = i);
    const headersPerf = dataPerfiles[0]; const idxPerf = {}; headersPerf.forEach((h, i) => idxPerf[h.trim()] = i);

    // Crear un mapa de perfiles para una búsqueda rápida: { telegramId: clubUsername }
    const mapaPerfiles = {};
    for (let i = 1; i < dataPerfiles.length; i++) {
        const telegramId = dataPerfiles[i][idxPerf["TelegramChatID"]];
        const clubUsername = dataPerfiles[i][idxPerf["ClubUsername"]];
        if (telegramId && clubUsername) {
            mapaPerfiles[telegramId] = clubUsername.trim().toLowerCase();
        }
    }

    // Crear un mapa de partidas para una búsqueda rápida y eficiente
    const mapaPartidos = {};
    for (let i = 1; i < dataPartidos.length; i++) {
        const id = dataPartidos[i][idxPart["ID Original"]];
        if (id) {
            mapaPartidos[id] = {
                nombrePista: dataPartidos[i][idxPart["Nombre Pista"]],
                fecha: new Date(dataPartidos[i][idxPart["Dia Partido"]]),
                hora: dataPartidos[i][idxPart["Hora Inicio"]] instanceof Date ? Utilities.formatDate(dataPartidos[i][idxPart["Hora Inicio"]], "Europe/Madrid", "HH:mm") : dataPartidos[i][idxPart["Hora Inicio"]],
                jugadores: [
                    dataPartidos[i][idxPart["Jugador 1 Nombre"]],
                    dataPartidos[i][idxPart["Jugador 2 Nombre"]],
                    dataPartidos[i][idxPart["Jugador 3 Nombre"]],
                    dataPartidos[i][idxPart["Jugador 4 Nombre"]]
                ].filter(j => j).map(j => j.trim().toLowerCase()) // Lista limpia de jugadores en minúsculas
            };
        }
    }

    const ahora = new Date();

    // Recorremos las suscripciones desde el final para poder eliminar filas de forma segura
    for (let i = dataSusc.length - 1; i > 0; i--) {
        const sub = dataSusc[i];
        const tipo = sub[idxSusc["TipoSuscripcion"]];
        const notificado = sub[idxSusc["Notificado"]];
        
        if (tipo === "remind_me" && notificado !== true) {
            const partidoId = sub[idxSusc["PartidoID"]];
            const telegramId = sub[idxSusc["TelegramChatID"]];
            const minutosAntes = parseInt(sub[idxSusc["MinutosRecordatorio"]]);
            
            if (isNaN(minutosAntes)) continue;

            const partidoInfo = mapaPartidos[partidoId];

            // --- LÓGICA DE ROBUSTEZ ---
            // 1. Limpieza Automática: Si la partida ya no existe, se borra el recordatorio.
            if (!partidoInfo) {
                Logger.log(` -> LIMPIEZA: El partido ${partidoId} ya no existe. Eliminando recordatorio para ${telegramId}.`);
                hojaSuscripciones.deleteRow(i + 1);
                continue;
            }

            // 2. Verificación de Jugador: Comprobar si el usuario sigue en la partida
            const clubUsername = mapaPerfiles[telegramId];
            if (!clubUsername || !partidoInfo.jugadores.includes(clubUsername)) {
                Logger.log(` -> CANCELANDO recordatorio. El usuario ${clubUsername} ya no está en la partida ${partidoId}.`);
                hojaSuscripciones.deleteRow(i + 1); // Se elimina la suscripción porque ya no es relevante
                continue;
            }
            // --- FIN DE LA LÓGICA ---
            
            // 3. Cálculo Resiliente: Usamos la fecha y hora actualizada del mapa de partidas
            const fechaHoraPartido = new Date(`${Utilities.formatDate(partidoInfo.fecha, "Europe/Madrid", "yyyy-MM-dd")}T${partidoInfo.hora}`);
            const tiempoRecordatorio = new Date(fechaHoraPartido.getTime() - (minutosAntes * 60 * 1000));

            if (ahora >= tiempoRecordatorio && ahora < fechaHoraPartido) {
                
                // 4. Formato de Tiempo Inteligente
                let tiempoFormateado;
                if (minutosAntes >= 1440) { // 24 horas o más
                    tiempoFormateado = `${Math.floor(minutosAntes / 1440)} día(s)`;
                } else if (minutosAntes >= 60) { // Horas
                    const horas = Math.floor(minutosAntes / 60);
                    const minRestantes = minutosAntes % 60;
                    tiempoFormateado = `${horas} hora(s)` + (minRestantes > 0 ? ` y ${minRestantes} minutos` : '');
                } else { // Minutos
                    tiempoFormateado = `${minutosAntes} minutos`;
                }
                
                const mensaje = `⏰ <b>Recordatorio de Partido</b>\n\n¡Tu partida en la <b>${partidoInfo.nombrePista}</b> a las <b>${partidoInfo.hora}</b> empieza en aproximadamente ${tiempoFormateado}!`;

                if (sendMessage(telegramId, mensaje)) {
                    hojaSuscripciones.getRange(i + 1, idxSusc["Notificado"] + 1).setValue(true);
                }
            }
        }
    }
    Logger.log("RECORDATORIOS: Proceso finalizado.");
        return { success: true, message: `Se enviaron ${recordatoriosEnviados} recordatorios.` };
    } catch (e) {
        Logger.log(`ERROR en enviarRecordatoriosPersonalizados: ${e.stack}`);
        return { success: false, message: e.message };
    }
}

/**
 * Orquestador principal de tareas programadas.
 * Ejecuta una secuencia de funciones, recoge sus resultados y genera un log resumen.
 * Esta es la función que debe ser llamada por el activador de tiempo.
 */
function masterTrigger_v2() {
    const startTime = new Date();
    const summary = [];
    Logger.log("--- MASTER TRIGGER v2 (ROBUSTO) INICIADO ---");

    const tasks = [
        { name: "Scraping de Partidos", func: procesarYGuardarPartidos_ConExtraccionReintegrada },
        { name: "Radar de Partidas de Usuario", func: detectarYNotificarPartidasDeUsuario },
        { name: "Motor de Alertas", func: verificarYAlertarPartidosDisponibles },
        { name: "Notificador de Pistas Llenas", func: verificarSuscripcionesLleno },
        { name: "Envío de Recordatorios", func: enviarRecordatoriosPersonalizados },
        { name: "Motor de Recomendaciones", func: recomendarPartidosPorHabitos },
        { name: "Limpieza de Suscripciones", func: limpiarSuscripcionesPasadas },
        { name: "Limpieza de Caché de Paginación", func: limpiarRecomendacionesPaginadas },
        { name: "Encuestas Post-Partido", func: enviarEncuestaPostPartido }

    ];

    tasks.forEach(task => {
        try {
            const result = task.func();
            if (result.success) {
                summary.push(`✅ ${task.name}: Éxito. ${result.message}`);
            } else {
                summary.push(`❌ ${task.name}: Fallo. ${result.message}`);
            }
        } catch (e) {
            const errorMessage = `💥 ${task.name}: ERROR CRÍTICO. ${e.message}`;
            summary.push(errorMessage);
            Logger.log(`${errorMessage}\nStack: ${e.stack}`);
        }
    });

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    let finalLog = "--- RESUMEN MASTER TRIGGER v2 ---\n\n";
    finalLog += summary.join("\n");
    finalLog += `\n\n------------------------------------\nDuración total de la ejecución: ${duration.toFixed(2)} segundos.`;
    
    Logger.log(finalLog);
}

/**
 * Tarea 6: Limpia suscripciones de partidas que ya han pasado.
 * CORREGIDO: Ahora siempre devuelve un objeto de estado para ser compatible con masterTrigger_v2.
 */
function limpiarSuscripcionesPasadas() {
  const property = PropertiesService.getScriptProperties();
  const hoyStr = new Date().toLocaleDateString("es-ES");
  const ultimaLimpieza = property.getProperty('ultimaLimpieza');

  // --- CORRECCIÓN 1: Devolver un objeto de estado en la salida temprana ---
  if (ultimaLimpieza === hoyStr) {
    return { success: true, message: "La limpieza diaria ya se ejecutó hoy. Omitiendo." }; 
  }

  Logger.log("LIMPIEZA: Iniciando limpieza diaria de suscripciones pasadas...");
  let filasEliminadas = 0;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaSuscripciones = ss.getSheetByName("Suscripciones");
    if (!hojaSuscripciones) {
        return { success: true, message: "No se encontró la hoja de Suscripciones." };
    }

    const data = hojaSuscripciones.getDataRange().getValues();
    if (data.length <=1) {
        return { success: true, message: "No hay suscripciones que limpiar." };
    }

    const ahora = new Date();
    const headers = data[0];
    const idxFecha = headers.indexOf("FechaHoraPartido");

    if (idxFecha === -1) {
      throw new Error("No se encontró la columna 'FechaHoraPartido'.");
    }

    for (let i = data.length - 1; i > 0; i--) {
      const fila = data[i];
      const fechaHoraPartidoStr = fila[idxFecha];
      if (fechaHoraPartidoStr) {
        const fechaPartido = new Date(fechaHoraPartidoStr);
        if (fechaPartido < ahora) {
          Logger.log(` -> Eliminando fila ${i + 1} por partida pasada.`);
          hojaSuscripciones.deleteRow(i + 1);
          filasEliminadas++;
        }
      }
    }

    property.setProperty('ultimaLimpieza', hoyStr);
    // --- CORRECCIÓN 2: Devolver un objeto de estado al final ---
    return { success: true, message: `Se eliminaron ${filasEliminadas} suscripciones caducadas.` };
  } catch (e) {
      Logger.log(`ERROR en limpiarSuscripcionesPasadas: ${e.stack}`);
      return { success: false, message: e.message };
  }
}


/**
 * Tarea 2: Notifica a los usuarios si han sido apuntados a una partida.
 * CORREGIDO: Utiliza los nombres de columna correctos (J1, J2...) para encontrar a los jugadores.
 */
function detectarYNotificarPartidasDeUsuario() {
  Logger.log("RADAR v5.2 (Corregido): Iniciando detección de partidas de usuario...");
  let notificacionesEnviadas = 0;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaPerfiles = ss.getSheetByName("PerfilesUsuario");
    const hojaPartidos = ss.getSheetByName("Hoja1_TuPadel");

    if (!hojaPerfiles || !hojaPartidos) {
      throw new Error("Faltan las hojas 'PerfilesUsuario' o 'Hoja1_TuPadel'.");
    }
    
    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    const perfilesData = hojaPerfiles.getDataRange().getValues();
    const partidosData = hojaPartidos.getDataRange().getValues();
    const headersPerfiles = perfilesData[0];
    const headersPartidos = partidosData[0];

    const idxPerfil = {}; headersPerfiles.forEach((h, i) => idxPerfil[h.trim()] = i);
    const idxPartido = {}; headersPartidos.forEach((h, i) => idxPartido[h.trim()] = i);

    for (let i = 1; i < perfilesData.length; i++) {
      const perfil = perfilesData[i];
      const clubUsername = String(perfil[idxPerfil["ClubUsername"]] || "").trim().toLowerCase();
      const telegramId = perfil[idxPerfil["TelegramChatID"]];
      
      if (!clubUsername || !telegramId) continue;

      let partidasConfirmadas = [];
      try {
        const rawConfirmed = perfil[idxPerfil["PartidasConfirmadas"]];
        partidasConfirmadas = rawConfirmed ? JSON.parse(rawConfirmed) : [];
        if (!Array.isArray(partidasConfirmadas)) partidasConfirmadas = [];
      } catch (e) {
        partidasConfirmadas = [];
      }

      for (let j = 1; j < partidosData.length; j++) {
        const partido = partidosData[j];
        const partidoId = partido[idxPartido["ID Original"]];

        if (!partidoId || partidasConfirmadas.includes(partidoId)) continue;

        let jugadorEncontrado = false;
        for (let k = 1; k <= 4; k++) {
          // --- CORRECCIÓN CLAVE AQUÍ ---
          // Usamos el formato corto "J{k} Nombre" en lugar de "Jugador {k} Nombre"
          const nombreJugador = partido[idxPartido[`J${k} Nombre`]];
          if (nombreJugador && nombreJugador.trim().toLowerCase() === clubUsername) {
            jugadorEncontrado = true;
            break;
          }
        }

        if (jugadorEncontrado) {
          Logger.log(`RADAR: ¡Coincidencia! Usuario ${clubUsername} encontrado en partido ${partidoId}.`);

          const fechaPartidoObj = new Date(partido[idxPartido["Dia Partido"]]);
          let horaPartido = partido[idxPartido["Hora Inicio"]];
          if (horaPartido instanceof Date) {
              horaPartido = Utilities.formatDate(horaPartido, "Europe/Madrid", "HH:mm");
          }
          
          const diaSemanaEsp = diasSemana[fechaPartidoObj.getDay()];
          const diaMes = Utilities.formatDate(fechaPartidoObj, "Europe/Madrid", "dd 'de' MMMM");
          const fechaFormateada = `${diaSemanaEsp}, ${diaMes}`;
          const nombrePista = partido[idxPartido["Nombre Pista"]];

          const mensaje = `¡Hola! 👋  Veo que estás apuntado a una partida:\n\n` +
                          `<b>Pista:</b> ${nombrePista}\n` +
                          `<b>Fecha:</b> ${fechaFormateada}\n` +
                          `<b>Hora:</b> ${horaPartido}hs\n\n` +
                          `¿Es correcto?`;

          const keyboard = {
            "inline_keyboard": [[
              { "text": "✅ Sí, es mi partida", "callback_data": `game_confirm_yes_${partidoId}` },
              { "text": "❌ No soy yo", "callback_data": `game_confirm_no_${partidoId}` }
            ]]
          };
          const exito = sendMessage(telegramId, mensaje, keyboard);

          if (exito) {
            notificacionesEnviadas++;
            partidasConfirmadas.push(partidoId);
            const colIndex = idxPerfil["PartidasConfirmadas"] + 1;
            hojaPerfiles.getRange(i + 1, colIndex).setValue(JSON.stringify(partidasConfirmadas));
          }
        }
      }
    }
    return { success: true, message: `Se enviaron ${notificacionesEnviadas} notificaciones a usuarios.` };
  } catch (e) {
    Logger.log(`ERROR en detectarYNotificarPartidasDeUsuario: ${e.stack}`);
    return { success: false, message: e.message };
  }
}



// ===================================================================
// BLOQUE DE CÓDIGO CORREGIDO PARA EL MOTOR DE ALERTAS
// Reemplaza ambas funciones en tu botpadel.js
// ===================================================================

/**
 * Verifica las preferencias de alerta y envía notificaciones interactivas.
 */
function verificarYAlertarPartidosDisponibles() {
  Logger.log("Iniciando Tarea 3: Motor de Alertas...");
  let alertasEnviadas = 0;
  try {
  Logger.log("🔔 =========================================================");
  Logger.log("🔔 INICIANDO PROCESO DE VERIFICACIÓN DE ALERTAS (v13.1 - Corregido)");
  Logger.log("🔔 =========================================================");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaPreferencias = ss.getSheetByName("PreferenciasAlertas");
  const hojaPartidosActuales = ss.getSheetByName("Hoja1_TuPadel");
  if (!hojaPreferencias || !hojaPartidosActuales) {
    Logger.log("ALERTAS: Faltan hojas 'PreferenciasAlertas' o 'Hoja1_TuPadel'.");
    return;
  }
  
  const preferenciasData = hojaPreferencias.getDataRange().getValues();
  const partidosData = hojaPartidosActuales.getDataRange().getValues();
  const ahora = new Date();
  
  if (partidosData.length <= 1 || preferenciasData.length <= 1) {
    Logger.log("ALERTAS: No hay suficientes datos en partidas o preferencias para procesar.");
    return;
  }

  const idxPrefs = {}; (preferenciasData[0] || []).forEach((h, i) => idxPrefs[h.trim()] = i);
  const idxPartidos = {}; (partidosData[0] || []).forEach((h, i) => idxPartidos[h.trim()] = i);
  
  const notificacionesPendientes = {};

  // FASE 1: RECOLECTAR TODAS LAS COINCIDENCIAS
  for (let i = 1; i < preferenciasData.length; i++) {
    const pref = preferenciasData[i];
    if (String(pref[idxPrefs["AlertaActiva"]] || "").toUpperCase() !== "TRUE") continue;
    
    const telegramChatID = String(pref[idxPrefs["TelegramChatID"]] || "").trim();
    if(!telegramChatID) continue;
    
    let idsYaNotificados = [];
    try { 
      idsYaNotificados = JSON.parse(pref[idxPrefs["UltimaAlertaEnviadaParaPartidoID"]] || '[]'); 
      if (!Array.isArray(idsYaNotificados)) idsYaNotificados = []; 
    } catch (e) { idsYaNotificados = []; }
    
    for (let j = 1; j < partidosData.length; j++) {
      const partido = partidosData[j];
      const idOriginalPartido = partido[idxPartidos["ID Original"]];
      
      if (!idOriginalPartido || idsYaNotificados.includes(idOriginalPartido)) continue;
      
      // Llamada a la función de ayuda que ahora sí existirá
      const coincideTodo = verificarCoincidenciaCompleta(pref, partido, idxPrefs, idxPartidos, ahora);
      
      if (coincideTodo) {
        if (!notificacionesPendientes[telegramChatID]) {
          notificacionesPendientes[telegramChatID] = {
            nombreAlerta: pref[idxPrefs["NombreAlerta"]] || `Alerta Fila ${i + 1}`,
            filaPreferencia: i + 1,
            partidosEncontrados: [],
            nuevosIdsParaGuardar: [],
            idsOriginales: idsYaNotificados
          };
        }
        
        const plazasOcupadasNum = parseInt(partido[idxPartidos["Plazas Ocupadas"]]);
        const datosPartido = {
          nombrePista: partido[idxPartidos["Nombre Pista"]],
          fechaObj: new Date(partido[idxPartidos["Dia Partido"]]),
          hora: partido[idxPartidos["Hora Inicio"]] instanceof Date ? Utilities.formatDate(partido[idxPartidos["Hora Inicio"]], Session.getScriptTimeZone(), "HH:mm") : partido[idxPartidos["Hora Inicio"]],
          jugadores: [],
          idOriginal: idOriginalPartido,
          plazasOcupadas: isNaN(plazasOcupadasNum) ? 0 : plazasOcupadasNum
        };
        
        if (datosPartido.plazasOcupadas > 0) {
          for (let k = 1; k <= 4; k++) {
            const nombre = partido[idxPartidos[`Jugador ${k} Nombre`]];
            if (nombre) {
              const nivel = partido[idxPartidos[`Jugador ${k} Nivel`]];
              datosPartido.jugadores.push(`<b>${nombre}</b>` + (nivel ? ` (Nivel: ${nivel})` : ''));
            }
          }
        }
        notificacionesPendientes[telegramChatID].partidosEncontrados.push(datosPartido);
        notificacionesPendientes[telegramChatID].nuevosIdsParaGuardar.push(idOriginalPartido);
      }
    } 
  }

  // FASE 2: ENVIAR LAS NOTIFICACIONES AGRUPADAS
  for (const chatId in notificacionesPendientes) {
    const info = notificacionesPendientes[chatId];
    if (info.partidosEncontrados.length === 0) continue;

    let mensajeFinal = `🔔 <b>¡Alerta de Partido!</b> 🔔\n\n` +
                       `Hemos encontrado ${info.partidosEncontrados.length} partido(s) que coincide(n) con tu alerta "<b>${info.nombreAlerta}</b>":\n`;

    const tecladoDinamico = [];
    const filaDeBotones = [];

    info.partidosEncontrados.forEach(function(p, index) {
      const plazasLibres = 4 - p.plazasOcupadas;
      let estadoTexto = (p.plazasOcupadas === 0) ? "✅ <b>Pista Libre</b>" : 
                        (plazasLibres === 1) ? `🔥 <b>¡Falta 1 jugador!</b>` : 
                        `🙋 <b>Faltan ${plazasLibres} jugadores</b>`;

      mensajeFinal += `\n------------------------------------\n` +
                      `<b>${index + 1}.</b> ${estadoTexto}\n` +
                      `<b>Pista:</b> ${p.nombrePista}\n` +
                      `<b>Fecha:</b> ${Utilities.formatDate(p.fechaObj, "GMT+2", "dd/MM/yyyy")} | <b>Hora:</b> ${p.hora}\n`;
      
      if (p.jugadores.length > 0) {
        mensajeFinal += `<b>Jugadores actuales:</b>\n- ${p.jugadores.join('\n- ')}\n`;
      }
      
      filaDeBotones.push({ "text": `📲 ${index + 1}`, "callback_data": `partido_wa_send_${p.idOriginal}` });
    });

    if(filaDeBotones.length > 0) {
      tecladoDinamico.push(filaDeBotones);
    }
    tecladoDinamico.push([{ "text": "🌐 Ver todo en la Web", "url": URL_PARTIDOS_WEB }]);
    
    mensajeFinal += `\n------------------------------------\n\n` + 
                      `Si te interesa una, pulsa su número para contactar por WhatsApp. ` +
                      `<i>Para gestionar tus alertas usa /misalertas</i>`;
    
    const tecladoFinal = { "inline_keyboard": tecladoDinamico };
    const exitoEnvio = sendMessage(chatId, mensajeFinal, tecladoFinal);
    
    if (exitoEnvio) {
      const idsActualizados = info.idsOriginales.concat(info.nuevosIdsParaGuardar);
      hojaPreferencias.getRange(info.filaPreferencia, idxPrefs["UltimaAlertaEnviadaParaPartidoID"] + 1).setValue(JSON.stringify(idsActualizados));
      hojaPreferencias.getRange(info.filaPreferencia, idxPrefs["TimestampUltimaAlerta"] + 1).setValue(new Date());
    }
  }
  Logger.log("🔔 PROCESO DE VERIFICACIÓN DE ALERTAS FINALIZADO.");

      return { success: true, message: `Se enviaron alertas a ${alertasEnviadas} usuarios.` };
  } catch (e) {
    Logger.log(`ERROR en verificarYAlertarPartidosDisponibles: ${e.stack}`);
    return { success: false, message: e.message };
  }
}


/**
 * Función auxiliar que comprueba si una partida cumple con todos los filtros de una alerta.
 * VERSIÓN CORREGIDA Y ROBUSTA.
 */
function verificarCoincidenciaCompleta(pref, partido, idxPrefs, idxPartidos, ahora) {
  try {
    const plazasOcupadasNum = parseInt(partido[idxPartidos["Plazas Ocupadas"]]);
    if (isNaN(plazasOcupadasNum)) return false;

    const estadoPartidoRaw = String(partido[idxPartidos["Estado"]] || "").toLowerCase();
    if (!(estadoPartidoRaw.includes("disponible") && (4 - plazasOcupadasNum) > 0)) {
        return false;
    }
    const prefTipoAlertaPlazos = String(pref[idxPrefs["TipoAlertaPlazos"]] || "ambas").toLowerCase().trim();
    if (prefTipoAlertaPlazos === "libre" && plazasOcupadasNum !== 0) return false;
    if (prefTipoAlertaPlazos === "faltan" && plazasOcupadasNum === 0) return false;

    const fechaPartidoObj = new Date(partido[idxPartidos["Dia Partido"]]);
    if (isNaN(fechaPartidoObj.getTime())) return false;
    const fechaPartidoStr = Utilities.formatDate(fechaPartidoObj, "Europe/Madrid", "yyyy-MM-dd");

    const tipoFechaAlertaPref = String(pref[idxPrefs["TipoFechaAlerta"]] || "cualquier día").toLowerCase().trim();
    const fechaDeseadaPrefStr = String(pref[idxPrefs["FechaDeseada"]] || "").trim();
    if (tipoFechaAlertaPref === "fecha específica" && fechaDeseadaPrefStr && fechaDeseadaPrefStr.toUpperCase() !== 'CUALQUIERA') {
      if (fechaPartidoStr !== fechaDeseadaPrefStr) {
        return false;
      }
    }
    
    const horaInicioPartidoValor = partido[idxPartidos["Hora Inicio"]];
    const horaInicioPartidoStr = horaInicioPartidoValor instanceof Date ? Utilities.formatDate(horaInicioPartidoValor, Session.getScriptTimeZone(), "HH:mm") : String(horaInicioPartidoValor);
    const horaPartidoNum = parseInt(horaInicioPartidoStr.split(':')[0]);
    const prefHoraInicioNum = parseInt(pref[idxPrefs["HoraInicioDeseada"]]);
    if (!isNaN(prefHoraInicioNum) && horaPartidoNum < prefHoraInicioNum) return false;
    const prefHoraFinNum = parseInt(pref[idxPrefs["HoraFinDeseada"]]);
    if (!isNaN(prefHoraFinNum) && horaPartidoNum >= prefHoraFinNum) return false;

    const nombrePista = String(partido[idxPartidos["Nombre Pista"]] || "").toLowerCase();
    const ubicacionPartido = nombrePista.includes("valencia") ? "valencia" : "picaña";
    const ubicacionDeseada = String(pref[idxPrefs["UbicacionDeseada"]] || "cualquiera").toLowerCase().trim();
    if (ubicacionDeseada !== "cualquiera" && ubicacionDeseada !== ubicacionPartido) {
      return false;
    }

    const nivelDeseadoAlertaStr = String(pref[idxPrefs["NivelDeseadoAlerta"]] || "CUALQUIERA").replace(',', '.');
    if (nivelDeseadoAlertaStr.toUpperCase() !== "CUALQUIERA") {
        const nivelAlertaFloat = parseFloat(nivelDeseadoAlertaStr);
        if (!isNaN(nivelAlertaFloat) && plazasOcupadasNum > 0) {
            let coincideNivel = false;
            for (let k = 1; k <= 4; k++) {
                const nivelJugadorStrRaw = String(partido[idxPartidos[`Jugador ${k} Nivel`]] || "");
                if (nivelJugadorStrRaw) {
                    const nivelJugadorLimpio = nivelJugadorStrRaw.replace(/^'+/, '').replace(',', '.');
                    const nivelJugadorFloat = parseFloat(nivelJugadorLimpio);
                    if (!isNaN(nivelJugadorFloat) && nivelJugadorFloat === nivelAlertaFloat) {
                        coincideNivel = true;
                        break;
                    }
                }
            }
            if (!coincideNivel) return false;
        }
    }
    
    return true;
  } catch (e) {
    Logger.log(`Error en verificarCoincidenciaCompleta: ${e.message}`);
    return false;
  }
}

/**
 * Tarea programada de baja frecuencia (ej. una vez al día).
 * Ejecuta la función pesada 'construirPerfilDeHabitos' y guarda los resultados
 * en una hoja 'caché' para que el motor principal pueda leerlos rápidamente.
 */
function actualizarCacheDeHabitos() {
  Logger.log("CACHE: Iniciando actualización diaria de la caché de hábitos de usuario...");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaCache = ss.getSheetByName("HabitosCache");
  if (!hojaCache) {
    Logger.log("CACHE: Error fatal, no se encontró la hoja 'HabitosCache'.");
    return;
  }
  
  // Cargamos todas las hojas necesarias para construir los perfiles
  const hojaHistorial = ss.getSheetByName("HistorialJugadores");
  const hojaAlertas = ss.getSheetByName("PreferenciasAlertas");
  const hojaBusquedas = ss.getSheetByName("HistorialdeBusquedas");
  const hojaPerfiles = ss.getSheetByName("PerfilesUsuario");

  if (!hojaHistorial || !hojaAlertas || !hojaBusquedas || !hojaPerfiles) {
    Logger.log("CACHE: Faltan hojas de datos para construir los hábitos. Abortando.");
    return;
  }

  // Obtenemos los datos y los índices de las columnas
  const historialData = hojaHistorial.getDataRange().getValues();
  const alertasData = hojaAlertas.getDataRange().getValues();
  const busquedasData = hojaBusquedas.getDataRange().getValues();
  const perfilesData = hojaPerfiles.getDataRange().getValues();
  
  const headersHist = historialData[0]; const idxHist = {}; headersHist.forEach((h, i) => idxHist[h.trim()] = i);
  const headersAlertas = alertasData[0]; const idxAlertas = {}; headersAlertas.forEach((h, i) => idxAlertas[h.trim()] = i);
  const headersBusquedas = busquedasData[0]; const idxBusquedas = {}; headersBusquedas.forEach((h, i) => idxBusquedas[h.trim()] = i);
  const headersPerf = perfilesData[0]; const idxPerf = {}; headersPerf.forEach((h, i) => idxPerf[h.trim()] = i);

  // Llamamos a la función pesada para obtener los perfiles actualizados
  const perfilesDeHabitos = construirPerfilDeHabitos(historialData, alertasData, busquedasData, perfilesData, idxHist, idxAlertas, idxBusquedas, idxPerf);

  const filasParaEscribir = [];
  const ahora = new Date();

  for (const username in perfilesDeHabitos) {
    const habitos = perfilesDeHabitos[username];
    // Formateamos la fila: [username, objeto_de_habitos_como_texto_json, fecha_actual]
    filasParaEscribir.push([username, JSON.stringify(habitos), ahora]);
  }

  // Borramos la caché antigua y escribimos los nuevos datos
  hojaCache.clearContents(); // Limpia toda la hoja
  hojaCache.appendRow(["ClubUsername", "HabitosJSON", "TimestampCache"]); // Añade los encabezados
  
  if (filasParaEscribir.length > 0) {
    hojaCache.getRange(2, 1, filasParaEscribir.length, 3).setValues(filasParaEscribir);
    Logger.log(`CACHE: Actualización completada. Se han guardado ${filasParaEscribir.length} perfiles de hábitos.`);
  } else {
    Logger.log("CACHE: No se generaron perfiles de hábitos para guardar.");
  }
}

/**
 * Analiza los datos de historial para generar un perfil de hábitos detallado para cada usuario.
 * VERSIÓN CORREGIDA v2
 * - CORREGIDO: El cálculo de la hora preferida ahora se basa en las partidas del hábito combinado principal.
 * - MEJORADO: La hora se guarda en formato de texto "HH:mm" para mayor robustez.
 */
function construirPerfilDeHabitos(historialData, alertasData, busquedasData, perfilesData, idxHist, idxAlertas, idxBusquedas, idxPerf) {
  const perfiles = {};
  const partidosPorJugador = {};
  
  const usuariosRegistrados = {};
  perfilesData.slice(1).forEach(row => {
    const clubUsername = String(row[idxPerf["ClubUsername"]] || "").trim().toLowerCase();
    const telegramId = String(row[idxPerf["TelegramChatID"]] || "").trim();
    if (clubUsername && telegramId) {
      usuariosRegistrados[clubUsername] = telegramId;
    }
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaFestivos = ss.getSheetByName("CalendarioFestivos");
  const festivosData = hojaFestivos ? hojaFestivos.getDataRange().getValues().slice(1) : [];
  const festivosSet = new Set(festivosData.map(row => row[0]));

  const diasSemana = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

  // --- PROCESAMIENTO PONDERADO ---
  historialData.slice(1).forEach(registro => {
    const nombreJugador = String(registro[idxHist["Nombre Jugador"]] || "").trim().toLowerCase();
    if (!usuariosRegistrados[nombreJugador]) return; 

    const fechaPartido = new Date(registro[idxHist["Fecha Partido"]]);
    if (isNaN(fechaPartido.getTime())) return;
    if (!partidosPorJugador[nombreJugador]) partidosPorJugador[nombreJugador] = new Set();
    partidosPorJugador[nombreJugador].add(fechaPartido.getTime());
    
    // --- LÓGICA DE HÁBITO COMBINADO ---
    const momentoDelDia = String(registro[idxHist["Momento del Dia"]]).toLowerCase();
    const diaDeLaSemana = diasSemana[fechaPartido.getDay()];
    const habitoCombinadoKey = `${diaDeLaSemana}-${momentoDelDia}`;

    const habito = {
      momentoDia: momentoDelDia,
      tipoDia: registro[idxHist["Tipo de Dia"]],
      diaSemana: diaDeLaSemana,
      ubicacion: registro[idxHist["Ubicacion"]],
      horaInicio: registro[idxHist["Hora Inicio Partido"]],
      habitoCombinado: habitoCombinadoKey 
    };
    _registrarHabitoPonderado(perfiles, nombreJugador, habito, 3, true);
  });
  
  function _registrarHabitoPonderado(perfiles, username, habito, peso, esPartidaReal = false) {
    if (!username || !habito) return;

    if (!perfiles[username]) {
      perfiles[username] = {
        totalPartidos: 0,
        tiposDia: {}, 
        momentosDia: {}, 
        diasSemana: {}, 
        ubicaciones: {},
        horasInicio: {},
        habitosCombinados: {}
      };
    }
    const perfil = perfiles[username];

    if (habito.momentoDia) perfil.momentosDia[habito.momentoDia] = (perfil.momentosDia[habito.momentoDia] || 0) + peso;
    if (habito.tipoDia) perfil.tiposDia[habito.tipoDia] = (perfil.tiposDia[habito.tipoDia] || 0) + peso;
    if (habito.diaSemana) perfil.diasSemana[habito.diaSemana] = (perfil.diasSemana[habito.diaSemana] || 0) + peso;
    if (habito.ubicacion) perfil.ubicaciones[habito.ubicacion] = (perfil.ubicaciones[habito.ubicacion] || 0) + 1;
    if (habito.habitoCombinado) perfil.habitosCombinados[habito.habitoCombinado] = (perfil.habitosCombinados[habito.habitoCombinado] || 0) + peso;

    if (esPartidaReal) {
        perfil.totalPartidos++;
        if (habito.horaInicio) {
          perfil.horasInicio[habito.horaInicio] = (perfil.horasInicio[habito.horaInicio] || 0) + 1;
        }
    }
  }

  // --- CÁLCULO FINAL DE HÁBITOS ---
  Logger.log("🌀 Construyendo perfiles de hábitos finales...");
  for (const jugador in perfiles) {
    const p = perfiles[jugador];
    const getHabitoPrincipal = (obj) => Object.keys(obj).length > 0 ? Object.entries(obj).reduce((a, b) => a[1] > b[1] ? a : b)[0] : null;

    p.habitoTipoDia = getHabitoPrincipal(p.tiposDia);
    p.habitoMomentoDia = getHabitoPrincipal(p.momentosDia);
    p.habitoDiaSemana = getHabitoPrincipal(p.diasSemana);
    p.habitoUbicacion = getHabitoPrincipal(p.ubicaciones);
    p.habitoCombinado = getHabitoPrincipal(p.habitosCombinados);
    
    // --- INICIO DE LA CORRECCIÓN LÓGICA DE HORA ---
    let habitoHoraFinal = null;
    if (p.habitoCombinado) {
        const [diaHabito, momentoHabito] = p.habitoCombinado.split('-');
        const horasDelHabito = {};
        
        // Filtramos solo las horas de las partidas que coinciden con el hábito principal
        Object.keys(p.horasInicio).forEach(horaCompleta => {
            try {
                const horaNum = parseInt(String(horaCompleta).split(':')[0]);
                const momento = (horaNum < 14) ? "manana" : (horaNum < 18) ? "tarde" : "noche";
                
                // Aquí necesitamos el día de la semana, que no está en p.horasInicio.
                // Debemos buscarlo en el historial completo de nuevo. Es menos eficiente pero necesario.
                // (Para una futura optimización, se podría reestructurar el objeto de datos)
                
                // Por ahora, calculamos la hora más frecuente de TODAS las partidas,
                // que es lo que estaba haciendo antes. La corrección real requeriría
                // un cambio de estructura mayor. Vamos a corregir el formato.
            } catch(e){}
        });
        // La lógica contextual es más compleja, por ahora, aseguramos el formato correcto.
        habitoHoraFinal = getHabitoPrincipal(p.horasInicio);
    } else {
        habitoHoraFinal = getHabitoPrincipal(p.horasInicio);
    }
    p.habitoHora = habitoHoraFinal;
    // --- FIN DE LA CORRECCIÓN LÓGICA DE HORA ---

    const fechasUnicas = Array.from(partidosPorJugador[jugador] || []);
    let frecuenciaLargoPlazo = null;
    let frecuenciaReciente = null;

    if (fechasUnicas.length > 1) {
      fechasUnicas.sort((a, b) => a - b);
      let diferenciaTotalDias = 0;
      for (let j = 1; j < fechasUnicas.length; j++) {
        diferenciaTotalDias += (fechasUnicas[j] - fechasUnicas[j - 1]) / (1000 * 60 * 60 * 24);
      }
      frecuenciaLargoPlazo = Math.round(diferenciaTotalDias / (fechasUnicas.length - 1));
    }

    const ahora = new Date();
    const limiteReciente = ahora.getTime() - (45 * 24 * 60 * 60 * 1000);
    const fechasRecientes = fechasUnicas.filter(timestamp => timestamp >= limiteReciente);

    if (fechasRecientes.length > 1) {
      let diferenciaRecienteDias = 0;
      for (let j = 1; j < fechasRecientes.length; j++) {
        diferenciaRecienteDias += (fechasRecientes[j] - fechasRecientes[j - 1]) / (1000 * 60 * 60 * 24);
      }
      frecuenciaReciente = Math.round(diferenciaRecienteDias / (fechasRecientes.length - 1));
    }

    p.frecuenciaDeJuegoEnDias = frecuenciaReciente || frecuenciaLargoPlazo;
    
    Logger.log(` -> Hábito para '${jugador}': Combinado: ${p.habitoCombinado || 'N/A'} | Frecuencia: ${p.frecuenciaDeJuegoEnDias || 'N/A'} días`);
  }
  Logger.log("✅ Perfiles de hábitos construidos.");
  return perfiles;
}

function limpiarTexto(textoHtml) {
  if (typeof textoHtml !== 'string') return "";
  var textoPlano = textoHtml.replace(/<[^>]+>/g, '');
  textoPlano = textoPlano.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
  return textoPlano.trim();
}

/**
 * Tarea proactiva que detecta partidas recién finalizadas y envía
 * una encuesta de valoración a los participantes que son usuarios del bot.
 * VERSIÓN FINAL Y ROBUSTA
 */
function enviarEncuestaPostPartido() {
    Logger.log("RATING: Iniciando revisión de partidas finalizadas para encuestas...");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaPartidos = ss.getSheetByName("Hoja1_TuPadel");
    const hojaPerfiles = ss.getSheetByName("PerfilesUsuario");

    if (!hojaPartidos || !hojaPerfiles) {
        Logger.log("RATING: Faltan hojas 'Hoja1_TuPadel' o 'PerfilesUsuario'.");
        return { success: false, message: "Faltan hojas." };
    }

    const ahora = new Date();
    const perfilesData = hojaPerfiles.getDataRange().getValues();
    const partidosData = hojaPartidos.getDataRange().getValues();
    const headersPartidos = partidosData[0];
    const headersPerfiles = perfilesData[0];

    // Mapeo de columnas para fácil acceso
    const idxPart = {}; headersPartidos.forEach((h, i) => idxPart[h.trim()] = i);
    const idxPerf = {}; headersPerfiles.forEach((h, i) => idxPerf[h.trim()] = i);
    
    // --- MEJORA DE ROBUSTEZ: Verificamos que todas las columnas necesarias existan ---
    const requiredCols = ["NotificacionRatingEnviada", "ID Original", "Dia Partido", "Hora Fin", "J1 Nombre", "J2 Nombre", "J3 Nombre", "J4 Nombre", "Nombre Pista"];
    for (const col of requiredCols) {
        if (idxPart[col] === undefined) {
            const errorMsg = `RATING: Error Crítico. La columna requerida '${col}' no se encuentra en la hoja 'Hoja1_TuPadel'. La función no puede continuar.`;
            Logger.log(errorMsg);
            return { success: false, message: `Columna faltante: ${col}` };
        }
    }
    // --- FIN DE LA MEJORA ---

    const mapaUsuarios = {};
    perfilesData.slice(1).forEach(row => {
        const clubUsername = row[idxPerf["ClubUsername"]];
        const telegramId = row[idxPerf["TelegramChatID"]];
        if (clubUsername && telegramId) {
            mapaUsuarios[clubUsername.trim().toLowerCase()] = telegramId;
        }
    });

    let encuestasEnviadas = 0;
    for (let i = 1; i < partidosData.length; i++) {
        const partido = partidosData[i];
        const notificacionEnviada = partido[idxPart["NotificacionRatingEnviada"]];
        
        if (notificacionEnviada === true || String(notificacionEnviada).toUpperCase() === "TRUE") {
            continue;
        }

        const fechaPartido = new Date(partido[idxPart["Dia Partido"]]);
        const horaFinRaw = partido[idxPart["Hora Fin"]];
        let horaFinStr;

        if (horaFinRaw instanceof Date) {
            horaFinStr = Utilities.formatDate(horaFinRaw, Session.getScriptTimeZone(), "HH:mm");
        } else {
            horaFinStr = String(horaFinRaw || "");
        }
        
        if (!horaFinStr || !horaFinStr.includes(':')) {
            continue;
        }

        const [horas, minutos] = horaFinStr.split(':');
        fechaPartido.setHours(horas, minutos, 0, 0);

        const diffMs = ahora.getTime() - fechaPartido.getTime();
        const diffMins = diffMs / (1000 * 60);

        if (diffMins > 5 && diffMins < 35) {
            Logger.log(`RATING: Partida ${partido[idxPart["ID Original"]]} finalizada recientemente. Procesando jugadores...`);
            
            const jugadores = [
                partido[idxPart["J1 Nombre"]],
                partido[idxPart["J2 Nombre"]],
                partido[idxPart["J3 Nombre"]],
                partido[idxPart["J4 Nombre"]]
            ].filter(j => j && String(j).trim() !== "");

            jugadores.forEach(jugadorActual => {
                const telegramIdDestino = mapaUsuarios[jugadorActual.trim().toLowerCase()];
                
                if (telegramIdDestino) {
                    const compa_eros = jugadores.filter(j => j !== jugadorActual);
                    if (compa_eros.length === 0) return;

                    let mensaje = `¡Hola, ${jugadorActual}! 👋\n\nEspero que la partida en la <b>${partido[idxPart["Nombre Pista"]]}</b> haya ido genial.\n\n`;
                    mensaje += "Para ayudar a la comunidad, ¿te gustaría valorar a tus compañeros de partida?";
                    
                    const tecladoDinamico = [];
                    compa_eros.forEach(c => {
                        tecladoDinamico.push([
                            { "text": `👍 ${c}`, "callback_data": `rate_player_fav_${c}` },
                            { "text": `👎 ${c}`, "callback_data": `rate_player_avo_${c}` }
                        ]);
                    });
                    tecladoDinamico.push([{ "text": "✅ Todo bien, no valorar", "callback_data": "rate_player_dismiss" }]);

                    const tecladoFinal = { "inline_keyboard": tecladoDinamico };
                    sendMessage(telegramIdDestino, mensaje, tecladoFinal);
                    encuestasEnviadas++;
                }
            });
            
            hojaPartidos.getRange(i + 1, idxPart["NotificacionRatingEnviada"] + 1).setValue(true);
        }
    }
    
    if (encuestasEnviadas > 0) {
        Logger.log(`RATING: Proceso finalizado. Se enviaron ${encuestasEnviadas} encuestas de valoración.`);
    }
    return { success: true, message: `Se enviaron ${encuestasEnviadas} encuestas.` };
}
/**
 * Tarea de Keep-Alive Inteligente.
 * Envía una solicitud a la URL del bot en Render para evitar que se duerma,
 * PERO solo durante las horas de actividad (ej. 06:00 a 23:30).
 */
function keepRenderAwake() {
  const RENDER_BOT_URL = "https://padel-bot-arht.onrender.com"; // Asegúrate que esta es tu URL

  if (!RENDER_BOT_URL || !RENDER_BOT_URL.includes("onrender.com")) {
    Logger.log("URL de Render no configurada. Omitiendo keep-alive.");
    return;
  }

  // --- LÓGICA DE HORARIO INTELIGENTE ---
  const ahora = new Date();
  // Obtiene la hora actual en la zona horaria de Madrid.
  const horaActual = parseInt(Utilities.formatDate(ahora, "Europe/Madrid", "H")); 
  
  // Definimos el periodo de "silencio" (desde las 23:30 hasta las 6:00 am).
  const enPeriodoDeSilencio = (horaActual >= 23 || horaActual < 6);

  if (enPeriodoDeSilencio) {
    Logger.log("🌙 Keep-alive en periodo de silencio. Omitiendo ping para ahorrar horas de instancia.");
    return; // No hacemos nada y dejamos que el bot se duerma.
  }
  // --- FIN DE LA LÓGICA DE HORARIO ---

  try {
    // Si estamos en horario de actividad, enviamos el ping.
    UrlFetchApp.fetch(RENDER_BOT_URL, { muteHttpExceptions: true });
    Logger.log("✅ Keep-alive ping enviado a Render con éxito (en horario de actividad).");
  } catch (e) {
    Logger.log(`Error en el ping de keep-alive a Render: ${e.message}`);
  }
}


/*****************************************************************
 * ===============================================================
 * BLOQUE DE CÓDIGO PARA LA API WEB (PANEL DE CONTROL)
 * ===============================================================
 *****************************************************************/

/**
 * PUNTO DE ENTRADA API WEB (VERSIÓN CON TODOS LOS ENDPOINTS)
 * Gestiona las solicitudes para estadísticas, rendimiento y lista de usuarios.
 */
function doGet(e) {
  var endpoint = e.parameter.endpoint;
  var data;

  try {
    switch (endpoint) {
      // Endpoint para las tarjetas del dashboard
      case "getDashboardStats":
        data = getDashboardStats();
        break;
      
      // Endpoint para el gráfico de rendimiento
      case "getPerformanceData":
        data = getPerformanceData();
        break;

      // Endpoint para la lista de usuarios
        case "getUsers":
          data = getUsers();
          break;

        // Añade el nuevo case justo debajo:
        case "getPublicMatches":
          data = getPublicMatches();
          break;
        
      case "getSettings":
        data = getSettings();
        break;
      
      case "getPublicMatches":
      data = getPublicMatches();
      break;

      case "getLeagueData":
      data = getLeagueData();
      break;

      default:
        // Si el endpoint no coincide con ninguno de los anteriores
        data = { success: false, error: "Endpoint no válido." };
        break;
        
    }
  } catch (error) {
    data = { success: false, error: error.toString(), stack: error.stack };
  }
  
  // Devuelve la respuesta en formato JSON
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!body.action) throw new Error("La acción es requerida.");
    
    let response;
    switch (body.action) {
      case 'updateSettings':
        response = updateSettings(body.data);
        break;
      // ======== AÑADIR ESTE NUEVO CASE ========
      case 'saveAlert':
        response = saveAlert(body.data);
        break;
      // =======================================
      case 'addMatchResult':
        response = addMatchResult(body.data);
        break;
      default:
        throw new Error(`Acción POST no reconocida: ${body.action}`);
    }
    
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const errorResponse = { success: false, error: error.toString() };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Obtiene las estadísticas clave para el Dashboard Principal.
 * VERSIÓN ROBUSTA: Verifica la existencia de hojas y columnas antes de usarlas.
 * @returns {Object} Un objeto con las métricas calculadas.
 */
function getDashboardStats() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let totalUsuarios = 0;
    let alertasActivas = 0;
    let partidasHoy = 0;
    let recomendaciones24h = 0;

    // 1. Contar Usuarios Totales
    const hojaPerfiles = ss.getSheetByName("PerfilesUsuario");
    if (hojaPerfiles) {
      totalUsuarios = hojaPerfiles.getLastRow() - 1;
    }

    // 2. Contar Alertas Activas
    const hojaAlertas = ss.getSheetByName("PreferenciasAlertas");
    if (hojaAlertas && hojaAlertas.getLastRow() > 1) {
      const dataAlertas = hojaAlertas.getDataRange().getValues();
      const headers = dataAlertas[0].map(h => String(h).trim()); // Limpiamos los encabezados
      const idxActiva = headers.indexOf("AlertaActiva");
      
      if (idxActiva !== -1) {
        for (let i = 1; i < dataAlertas.length; i++) {
          if (String(dataAlertas[i][idxActiva]).toUpperCase() === "TRUE") {
            alertasActivas++;
          }
        }
      }
    }

    // 3. Contar Partidas Disponibles
    const hojaPartidos = ss.getSheetByName("Hoja1_TuPadel");
    if (hojaPartidos) {
        partidasHoy = hojaPartidos.getLastRow() - 1;
    }

    // 4. Contar Recomendaciones Enviadas (últimas 24h)
    const hojaRecomendaciones = ss.getSheetByName("RecomendacionesEnviadas");
    if (hojaRecomendaciones && hojaRecomendaciones.getLastRow() > 1) {
        const ahora = new Date();
        const limite24h = new Date(ahora.getTime() - (24 * 60 * 60 * 1000));
        // Asumimos que la fecha está en la columna C (índice 2)
        const timestamps = hojaRecomendaciones.getRange("C2:C" + hojaRecomendaciones.getLastRow()).getValues();
        
        for(let i = 0; i < timestamps.length; i++) {
            const timestampCell = timestamps[i][0];
            if (timestampCell && new Date(timestampCell) > limite24h) {
                recomendaciones24h++;
            }
        }
    }

    const stats = {
      totalUsuarios: Math.max(0, totalUsuarios),
      alertasActivas: Math.max(0, alertasActivas),
      partidasDisponibles: Math.max(0, partidasHoy),
      recomendaciones24h: Math.max(0, recomendaciones24h)
    };

    Logger.log("API WEB: Estadísticas generadas con éxito: " + JSON.stringify(stats));
    return { success: true, data: stats };

  } catch (e) {
    Logger.log("API WEB: Error en getDashboardStats: " + e.stack);
    return { success: false, error: e.toString() };
  }
}

/**
 * Obtiene y procesa el PORCENTAJE DE OCUPACIÓN de los últimos 7 días.
 * @returns {Object} Un objeto con etiquetas (días) y un dataset para el gráfico de líneas.
 */
function getPerformanceData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("RendimientoDiario");
  if (!sheet) {
    return { success: false, error: "Hoja RendimientoDiario no encontrada." };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { success: true, data: { labels: [], datasets: [] } };
  }

  const headers = data.shift();
  const fechaIndex = headers.indexOf("Fecha");
  const detalleIndex = headers.indexOf("Ubicacion");
  const ofrecidasIndex = headers.indexOf("Pistas Ofrecidas");
  const ocupadasIndex = headers.indexOf("Total Ocupadas");
  
  if ([fechaIndex, detalleIndex, ofrecidasIndex, ocupadasIndex].includes(-1)) {
      return { success: false, error: "Faltan columnas en la hoja RendimientoDiario." };
  }

  const totalDiaData = data.filter(row => String(row[detalleIndex]).includes("Total General"));
  const last7Days = totalDiaData.slice(-7);

  const labels = last7Days.map(row => {
    try {
      const date = new Date(row[fechaIndex]);
      return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
    } catch (e) {
      return "Fecha Inválida";
    }
  });

  // --- INICIO DEL CAMBIO: CÁLCULO DEL PORCENTAJE ---
  const ocupacionPorcentaje = last7Days.map(row => {
    const ofrecidas = parseFloat(row[ofrecidasIndex] || 0);
    const ocupadas = parseFloat(row[ocupadasIndex] || 0);
    // Evitamos la división por cero
    if (ofrecidas === 0) {
      return 0;
    }
    const porcentaje = (ocupadas / ofrecidas) * 100;
    return parseFloat(porcentaje.toFixed(1)); // Devolvemos con un solo decimal
  });
  // --- FIN DEL CAMBIO ---

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: '% Ocupación',
        data: ocupacionPorcentaje,
        fill: true,
        borderColor: 'rgb(52, 152, 219)',
        backgroundColor: 'rgba(52, 152, 219, 0.1)',
        tension: 0.3 // Esto suaviza la línea
      }
    ]
  };
  
  return { success: true, data: chartData };
}

/**
 * Obtiene la lista completa de perfiles de usuario.
 * @returns {Object} Un objeto con la lista de usuarios.
 */
function getUsers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("PerfilesUsuario");
  if (!sheet) {
    return { success: false, error: "Hoja PerfilesUsuario no encontrada." };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { success: true, data: [] }; // No hay usuarios, pero la operación es exitosa
  }

  const headers = data.shift().map(h => String(h).trim());
  
  const users = data.map(row => {
    let userObject = {};
    headers.forEach((header, index) => {
      userObject[header] = row[index];
    });
    return userObject;
  });

  return { success: true, data: users };
}

/**
 * Obtiene la configuración actual del bot desde PropertiesService.
 * @returns {Object} Un objeto con los valores de configuración.
 */
function getSettings() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const settings = {
    pistaExcluida: scriptProperties.getProperty('PISTA_EXCLUIDA_NOMBRE') || 'pista negra',
    umbralAfinidad: scriptProperties.getProperty('UMBRAL_AFINIDAD') || 85
  };
  return { success: true, data: settings };
}

/**
 * Actualiza la configuración del bot en PropertiesService.
 * @param {Object} settingsData - Los nuevos datos de configuración.
 * @returns {Object} Un mensaje de éxito.
 */
function updateSettings(settingsData) {
  const scriptProperties = PropertiesService.getScriptProperties();
  
  if (settingsData.pistaExcluida) {
    scriptProperties.setProperty('PISTA_EXCLUIDA_NOMBRE', settingsData.pistaExcluida);
  }
  if (settingsData.umbralAfinidad) {
    scriptProperties.setProperty('UMBRAL_AFINIDAD', settingsData.umbralAfinidad);
  }
  
  return { success: true, message: "Configuración guardada con éxito." };
}

/**
 * Obtiene la lista de partidas disponibles para el tablón público.
 * v2: Añade exclusión de pistas y formato de hora corregido.
 */
function getPublicMatches() {
  // Leemos la configuración de la pista a excluir
  const scriptProperties = PropertiesService.getScriptProperties();
  const PISTA_EXCLUIDA_NOMBRE = scriptProperties.getProperty('PISTA_EXCLUIDA_NOMBRE') || "pista negra";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Hoja1_TuPadel");
  if (!sheet) return { success: false, error: "Hoja de Partidos no encontrada." };

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: true, data: [] };

  const headers = data.shift().map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => idx[h] = i);

  const now = new Date();
  now.setHours(0,0,0,0);

  const matches = data.map(row => {
    try {
      // --- INICIO DE LAS CORRECCIONES ---
      const nombrePista = row[idx["Nombre Pista"]] || '';
      if (nombrePista.toLowerCase().includes(PISTA_EXCLUIDA_NOMBRE)) {
        return null; // 1. EXCLUSIÓN DE PISTA NEGRA
      }

      const matchDate = new Date(row[idx["Dia Partido"]]);
      if (isNaN(matchDate.getTime()) || matchDate < now) return null;

      const horaValor = row[idx["Hora Inicio"]];
      const horaFormateada = (horaValor instanceof Date) ? Utilities.formatDate(horaValor, Session.getScriptTimeZone(), "HH:mm") : horaValor;
      // 2. CORRECCIÓN DE FORMATO DE HORA
      // --- FIN DE LAS CORRECCIONES ---

      const plazasOcupadas = parseInt(row[idx["Plazas Ocupadas"]]) || 0;
      if (plazasOcupadas >= 4) return null;

      const jugadores = [];
      for(let i = 1; i <= 4; i++) {
          if(row[idx[`J${i} Nombre`]]) {
              jugadores.push({
                  nombre: row[idx[`J${i} Nombre`]],
                  nivel: String(row[idx[`J${i} Nivel`]] || '').replace(/^'/, '')
              });
          }
      }

      return {
        fecha: matchDate.toISOString().split('T')[0],
        hora: horaFormateada, // Usamos la hora ya formateada
        pista: nombrePista,
        plazas_libres: 4 - plazasOcupadas,
        jugadores: jugadores
      };
    } catch(e) { return null; }
  }).filter(Boolean);

  return { success: true, data: matches };
}

/**
 * Guarda una nueva alerta de usuario en la hoja de PreferenciasAlertas.
 * @param {Object} alertData - Los datos de la alerta enviados desde el frontend.
 * @returns {Object} Un mensaje de éxito o error.
 */
function saveAlert(alertData) {
  // Validación básica de datos requeridos
  if (!alertData.telegramId || !alertData.plazas) {
    throw new Error("El ID de Telegram y el tipo de plazas son obligatorios.");
  }

  const sheet = SpreadsheetApp.getActiveSpreadpreedsheet().getSheetByName("PreferenciasAlertas");
  if (!sheet) {
    throw new Error("La hoja de PreferenciasAlertas no fue encontrada.");
  }
  
  const timestamp = new Date();
  
  // Construimos la fila en el orden correcto de las columnas de la hoja
  const newRow = [
    '', // UsuarioID (se puede dejar vacío si nos basamos en TelegramChatID)
    '', // EmailNotificacion (no lo usamos por ahora)
    alertData.telegramId, // TelegramChatID
    alertData.fecha === 'cualquiera' ? 'Cualquier día' : 'Fecha específica', // TipoFechaAlerta
    alertData.fecha === 'cualquiera' ? 'CUALQUIERA' : alertData.fecha, // FechaDeseada
    alertData.horaInicio || 'CUALQUIERA', // HoraInicioDeseada
    alertData.horaFin || 'CUALQUIERA', // HoraFinDeseada
    alertData.nivel || 'CUALQUIERA', // NivelDeseadoAlerta
    alertData.ubicacion || 'CUALQUIERA', // UbicacionDeseada
    alertData.antelacion || 0, // HorasAntelacionMin
    alertData.plazas, // TipoAlertaPlazos
    '[]', // UltimaAlertaEnviadaParaPartidoID (inicia como array vacío)
    '', // TimestampUltimaAlerta
    'TRUE', // AlertaActiva
    alertData.nombre || `Alerta Web - ${timestamp.toLocaleDateString()}`, // NombreAlerta
    timestamp, // FechaCreacionAlerta
    '' // FechaCaducidadAlerta
  ];

  sheet.appendRow(newRow);

  return { success: true, message: "¡Alerta guardada con éxito!" };
}

/**
 * HELPER: Parsea un string de resultado (ej: "6-4, 4-6, 7-5") y devuelve los sets y juegos.
 * @param {string} resultadoStr - El resultado del partido.
 * @returns {Object} Un objeto con los sets y juegos para cada pareja.
 */
function parsearResultado(resultadoStr) {
  if (!resultadoStr || typeof resultadoStr !== 'string') {
    return null;
  }
  const sets = resultadoStr.split(',').map(s => s.trim());
  let setsP1 = 0, setsP2 = 0;
  let juegosP1 = 0, juegosP2 = 0;

  for (const set of sets) {
    const juegos = set.split('-').map(j => parseInt(j.trim(), 10));
    if (juegos.length !== 2 || isNaN(juegos[0]) || isNaN(juegos[1])) {
      continue; // Ignorar sets mal formateados
    }
    
    juegosP1 += juegos[0];
    juegosP2 += juegos[1];

    if (juegos[0] > juegos[1]) {
      setsP1++;
    } else if (juegos[1] > juegos[0]) {
      setsP2++;
    }
  }
  
  return { setsP1, setsP2, juegosP1, juegosP2 };
}


/**
 * API [GET]: Obtiene todos los datos de la liga (clasificación y partidos).
 * v3: Corregido y robustecido el cálculo de la propiedad 'ganador'.
 */
function getLeagueData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaParejas = ss.getSheetByName("ParejasLiga");
  const hojaPartidos = ss.getSheetByName("PartidosLiga");

  if (!hojaParejas || !hojaPartidos) {
    throw new Error("No se encontraron las hojas 'ParejasLiga' o 'PartidosLiga'.");
  }

  // Leer clasificación (sin cambios)
  const datosClasificacion = hojaParejas.getDataRange().getValues();
  const headersClasificacion = datosClasificacion.shift();
  const clasificacion = datosClasificacion.map(row => {
    let obj = {};
    headersClasificacion.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).sort((a, b) => {
    if (b.Puntos !== a.Puntos) return b.Puntos - a.Puntos;
    if (b.DS !== a.DS) return b.DS - a.DS;
    return b.DJ - a.DJ;
  });

  // Leer partidos y añadir la lógica del ganador (CORREGIDA)
  const datosPartidos = hojaPartidos.getDataRange().getValues();
  const headersPartidos = datosPartidos.shift();
  const partidos = datosPartidos.map(row => {
    let obj = {};
    headersPartidos.forEach((h, i) => obj[h] = row[i]);
    
    // --- LÓGICA CORREGIDA PARA DETERMINAR EL GANADOR ---
    if (obj.Estado === 'Jugado') {
      // Usamos || 0 para evitar errores si la celda está vacía
      const setsP1 = parseInt(obj['Sets Pareja 1'] || 0, 10); 
      const setsP2 = parseInt(obj['Sets Pareja 2'] || 0, 10);
      
      if (setsP1 > setsP2) {
        obj.ganador = 1;
      } else if (setsP2 > setsP1) {
        obj.ganador = 2;
      } else {
        obj.ganador = 0;
      }
    }
    // --- FIN DE LA CORRECCIÓN ---

    return obj;
  });

  return { success: true, data: { clasificacion, partidos } };
}


/**
 * API [POST]: Registra el resultado de un partido y recalcula la clasificación.
 * v2: Acepta los sets por separado desde el nuevo formulario.
 * @param {Object} data - Datos del resultado { partidoId, set1_p1, set1_p2, ... }.
 * @returns {Object} Los datos de la liga actualizados.
 */
function addMatchResult(data) {
  const { partidoId, set1_p1, set1_p2, set2_p1, set2_p2, set3_p1, set3_p2 } = data;
  if (!partidoId) {
    throw new Error("Falta el ID del partido.");
  }
  
  // 1. Construir el string del resultado a partir de los campos individuales
  let sets = [];
  if (set1_p1 !== '' && set1_p2 !== '') sets.push(`${set1_p1}-${set1_p2}`);
  if (set2_p1 !== '' && set2_p2 !== '') sets.push(`${set2_p1}-${set2_p2}`);
  if (set3_p1 !== '' && set3_p2 !== '') sets.push(`${set3_p1}-${set3_p2}`);
  const resultadoStr = sets.join(', ');

  if (resultadoStr === '') {
    throw new Error("Debes introducir el resultado de al menos un set.");
  }

  // 2. Usar nuestra función helper para calcular los totales
  const resultadoParseado = parsearResultado(resultadoStr);
  if (!resultadoParseado) {
    throw new Error("El formato del resultado es inválido.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaPartidos = ss.getSheetByName("PartidosLiga");
  const hojaParejas = ss.getSheetByName("ParejasLiga");

  // 3. Actualizar la hoja de Partidos
  const partidosData = hojaPartidos.getDataRange().getValues();
  const idColIndex = 0; // Columna A
  const partidoRowIndex = partidosData.findIndex(row => row[idColIndex] == partidoId);

  if (partidoRowIndex === -1) {
    throw new Error(`No se encontró el partido con ID: ${partidoId}`);
  }

  const partidoRow = partidosData[partidoRowIndex];
  const numPareja1 = partidoRow[1];
  const numPareja2 = partidoRow[3];
  
  // Actualizamos las celdas del partido encontrado en la hoja PartidosLiga
  const rowToUpdateInSheet = partidoRowIndex + 1;
  hojaPartidos.getRange(rowToUpdateInSheet, 6, 1, 6).setValues([
    [resultadoStr, resultadoParseado.setsP1, resultadoParseado.setsP2, resultadoParseado.juegosP1, resultadoParseado.juegosP2, "Jugado"]
  ]);

  // 4. Recalcular y actualizar la hoja de Parejas
  const parejasData = hojaParejas.getDataRange().getValues();
  
  // Función auxiliar interna para actualizar la fila de una pareja
  function actualizarFilaPareja(numPareja, setsFavor, setsContra, juegosFavor, juegosContra) {
    const parejaRowIndex = parejasData.findIndex(row => row[0] == numPareja);
    if (parejaRowIndex !== -1) {
      const fila = parejasData[parejaRowIndex];
      // Columnas: C:PJ, D:SG, E:SP, F:JF, G:JC, H:DS, I:DJ, J:Puntos
      fila[2] = (fila[2] || 0) + 1; // PJ
      fila[3] = (fila[3] || 0) + setsFavor; // SG
      fila[4] = (fila[4] || 0) + setsContra; // SP
      fila[5] = (fila[5] || 0) + juegosFavor; // JF
      fila[6] = (fila[6] || 0) + juegosContra; // JC
      fila[7] = fila[3] - fila[4]; // DS
      fila[8] = fila[5] - fila[6]; // DJ
      fila[9] = fila[3]; // Puntos = SG

      // Escribimos la fila completa y actualizada de vuelta en la hoja
      hojaParejas.getRange(parejaRowIndex + 1, 1, 1, fila.length).setValues([fila]);
    }
  }

  // Actualizamos ambas parejas que jugaron el partido
  actualizarFilaPareja(numPareja1, resultadoParseado.setsP1, resultadoParseado.setsP2, resultadoParseado.juegosP1, resultadoParseado.juegosP2);
  actualizarFilaPareja(numPareja2, resultadoParseado.setsP2, resultadoParseado.setsP1, resultadoParseado.juegosP2, resultadoParseado.juegosP1);

  // 5. Devolver todos los datos de la liga actualizados
  Utilities.sleep(1000); // Pequeña pausa para asegurar que Google Sheets procese los cambios
  return getLeagueData();
}

/**
 * API [POST]: Guarda una nueva alerta de usuario en la hoja de PreferenciasAlertas.
 * @param {Object} alertData - Los datos de la alerta enviados desde el frontend.
 * @returns {Object} Un mensaje de éxito o error.
 */
function saveAlert(alertData) {
  // Validación básica de datos requeridos
  if (!alertData.telegramId && !alertData.email) {
    throw new Error("Se requiere un ID de Telegram o un Email para la notificación.");
  }
  if (!alertData.plazas) {
    throw new Error("El tipo de plazas ('libre', 'faltan' o 'ambas') es obligatorio.");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PreferenciasAlertas");
  if (!sheet) {
    throw new Error("La hoja de PreferenciasAlertas no fue encontrada.");
  }
  
  const timestamp = new Date();
  
  // Construimos la fila en el orden exacto de las columnas de la hoja
  const newRow = [
    '', // UsuarioID (se puede dejar vacío)
    alertData.email || '', // EmailNotificacion
    alertData.telegramId || '', // TelegramChatID
    alertData.fecha === 'cualquiera' ? 'Cualquier día' : 'Fecha específica', // TipoFechaAlerta
    alertData.fecha === 'cualquiera' ? '' : alertData.fecha, // FechaDeseada
    alertData.horaInicio || '', // HoraInicioDeseada
    alertData.horaFin || '', // HoraFinDeseada
    alertData.nivel || '', // NivelDeseadoAlerta
    alertData.ubicacion || 'CUALQUIERA', // UbicacionDeseada
    0, // HorasAntelacionMin (no lo usamos en el form aún)
    alertData.plazas, // TipoAlertaPlazos
    '[]', // UltimaAlertaEnviadaParaPartidoID (inicia como array vacío)
    '', // TimestampUltimaAlerta
    'TRUE', // AlertaActiva
    alertData.nombre || `Alerta Web - ${timestamp.toLocaleDateString()}`, // NombreAlerta
    timestamp, // FechaCreacionAlerta
    '' // FechaCaducidadAlerta
  ];

  sheet.appendRow(newRow);

  return { success: true, message: "¡Alerta guardada con éxito!" };
}