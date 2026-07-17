<?php
$uri = urldecode(parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH));
$file = __DIR__ . "/public" . $uri;
if ($uri !== "/" && file_exists($file) && !is_dir($file)) {
    return false;
}
require_once __DIR__ . "/public/index.php";
