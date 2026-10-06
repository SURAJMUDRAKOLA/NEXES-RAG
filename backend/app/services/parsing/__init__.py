# app/services/parsing/__init__.py
# Parser factory — returns correct parser for each doc type
from app.services.parsing.pdf import PDFParser
from app.services.parsing.pptx_parser import PPTXParser
from app.services.parsing.docx_parser import DOCXParser
from app.services.parsing.image_parser import ImageParser
from app.services.parsing.audio_parser import AudioParser

_PARSERS = {
    "pdf":   PDFParser,
    "pptx":  PPTXParser,
    "docx":  DOCXParser,
    "image": ImageParser,
    "audio": AudioParser,
    "xlsx":  DOCXParser,
}


def get_parser(doc_type: str):
    parser_cls = _PARSERS.get(doc_type, PDFParser)
    return parser_cls()
